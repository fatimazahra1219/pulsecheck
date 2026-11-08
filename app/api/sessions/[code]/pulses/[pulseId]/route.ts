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

type PulseStatusRecord = {
  _id: { toString(): string };
  concept: string;
  isActive: boolean;
  isPaused?: boolean;
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

    const action = body.action;

    if (action !== "pause" && action !== "resume" && action !== "end") {
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
    }

    await session.save();

    return NextResponse.json({
      message:
        action === "pause"
          ? "Pulse paused successfully!"
          : action === "resume"
            ? "Pulse resumed successfully!"
            : "Pulse ended successfully!",

      pulse: {
        id: pulse._id.toString(),
        concept: pulse.concept,
        isActive: pulse.isActive,
        isPaused: pulse.isPaused,
      },
    });
  } catch (error) {
    console.error("Pulse action failed:", error);

    return NextResponse.json(
      { error: "Unable to update Pulse." },
      { status: 500 },
    );
  }
}
