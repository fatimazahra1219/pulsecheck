import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";
import { verifyTeacherAccess } from "@/lib/teacher-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
    pulseId: string;
  }>;
};

type InterventionStatusRecord = {
  _id?: { toString(): string };
  title: string;
  instructions: string;
  teacherMaterial?: string;
  isActive: boolean;
  createdAt: Date;
  completedAt?: Date;
};

type PulseStatusRecord = {
  _id: { toString(): string };
  concept: string;
  isActive: boolean;
  isPaused?: boolean;
  interventions?: InterventionStatusRecord[];
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { code, pulseId } = await params;
    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid classroom code." },
        { status: 400 },
      );
    }

    // Only the classroom teacher can manage Pulses.
    const isTeacher = await verifyTeacherAccess(request, normalizedCode);

    if (!isTeacher) {
      return NextResponse.json(
        { error: "Unauthorized. Only the teacher can manage Pulses." },
        { status: 401 },
      );
    }

    if (
      !/^[a-f0-9]{24}$/i.test(pulseId) ||
      !mongoose.Types.ObjectId.isValid(pulseId)
    ) {
      return NextResponse.json({ error: "Invalid Pulse ID." }, { status: 400 });
    }

    // Read the requested action.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("action" in body)
    ) {
      return NextResponse.json(
        { error: "An action is required." },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action;

    if (
      action !== "pause" &&
      action !== "resume" &&
      action !== "end" &&
      action !== "launch_intervention" &&
      action !== "end_intervention"
    ) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    await connectDB();

    const session = await Session.findOne({
      code: normalizedCode,
      isActive: true,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Classroom not found or inactive." },
        { status: 404 },
      );
    }

    const pulseRecords = session.pulses as unknown as PulseStatusRecord[];

    const pulse = pulseRecords.find((item) => item._id.toString() === pulseId);
    if (!pulse || !pulse.isActive) {
      return NextResponse.json(
        { error: "Active Pulse not found." },
        { status: 404 },
      );
    }

    // Launch a new classroom intervention.
    if (action === "launch_intervention") {
      const rawIntervention = payload.intervention;

      if (
        !rawIntervention ||
        typeof rawIntervention !== "object" ||
        Array.isArray(rawIntervention)
      ) {
        return NextResponse.json(
          { error: "Intervention details are required." },
          { status: 400 },
        );
      }

      const details = rawIntervention as Record<string, unknown>;

      const title = details.title;
      const instructions = details.instructions;
      const teacherMaterial = details.teacherMaterial ?? "";

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 100 ||
        typeof instructions !== "string" ||
        !instructions.trim() ||
        instructions.trim().length > 1000 ||
        typeof teacherMaterial !== "string" ||
        teacherMaterial.length > 5000
      ) {
        return NextResponse.json(
          { error: "Invalid intervention details." },
          { status: 400 },
        );
      }

      const interventions = pulse.interventions ?? [];

      // Allow only one active intervention per Pulse.
      if (interventions.some((item) => item.isActive)) {
        return NextResponse.json(
          { error: "An intervention is already active." },
          { status: 409 },
        );
      }

      pulse.interventions = interventions;

      pulse.interventions.push({
        title: title.trim(),
        instructions: instructions.trim(),
        teacherMaterial: teacherMaterial.trim(),
        isActive: true,
        createdAt: new Date(),
      });
    }

    // End the currently active intervention.
    if (action === "end_intervention") {
      const activeIntervention = (pulse.interventions ?? []).find(
        (item) => item.isActive,
      );

      if (!activeIntervention) {
        return NextResponse.json(
          { error: "No active intervention was found." },
          { status: 409 },
        );
      }

      activeIntervention.isActive = false;
      activeIntervention.completedAt = new Date();
    }

    // Pause the Pulse without ending it.
    if (action === "pause") {
      if (pulse.isPaused) {
        return NextResponse.json(
          { error: "This Pulse is already paused." },
          { status: 409 },
        );
      }

      pulse.isPaused = true;
    }

    // Resume a previously paused Pulse.
    if (action === "resume") {
      if (!pulse.isPaused) {
        return NextResponse.json(
          { error: "This Pulse is not paused." },
          { status: 409 },
        );
      }

      pulse.isPaused = false;
    }

    // Permanently end the Pulse.
    if (action === "end") {
      pulse.isActive = false;
      pulse.isPaused = false;

      // Also end any active intervention.
      for (const intervention of pulse.interventions ?? []) {
        if (intervention.isActive) {
          intervention.isActive = false;
          intervention.completedAt = new Date();
        }
      }
    }

    await session.save();

    const activeIntervention = (pulse.interventions ?? []).find(
      (item) => item.isActive,
    );

    return NextResponse.json({
      message:
        action === "pause"
          ? "Pulse paused successfully!"
          : action === "resume"
            ? "Pulse resumed successfully!"
            : action === "end"
              ? "Pulse ended successfully!"
              : action === "launch_intervention"
                ? "Intervention launched successfully!"
                : "Intervention ended successfully!",

      pulse: {
        id: pulse._id.toString(),
        concept: pulse.concept,
        isActive: pulse.isActive,
        isPaused: pulse.isPaused,
      },

      activeIntervention: activeIntervention
        ? {
            id: activeIntervention._id?.toString(),
            title: activeIntervention.title,
            instructions: activeIntervention.instructions,
            teacherMaterial: activeIntervention.teacherMaterial ?? "",
          }
        : null,
    });
  } catch (error) {
    console.error("Pulse action failed:", error);

    return NextResponse.json(
      { error: "Unable to update Pulse." },
      { status: 500 },
    );
  }
}
