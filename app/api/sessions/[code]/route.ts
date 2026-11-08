import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";
import { verifyTeacherAccess } from "@/lib/teacher-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type ActivePulseRecord = {
  _id: {
    toString(): string;
  };
  concept: string;
  question: string;
  isActive: boolean;
  isPaused?: boolean;
};

// Retrieve an active classroom session.
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { code } = await params;
    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid session code." },
        { status: 400 },
      );
    }

    await connectDB();

    const session = await Session.findOne({
      code: normalizedCode,
      isActive: true,
    }).select("code topic isActive pulses");

    if (!session) {
      return NextResponse.json(
        { error: "Session not found or no longer active." },
        { status: 404 },
      );
    }

    const pulseRecords = session.pulses as unknown as ActivePulseRecord[];

    const activePulse = pulseRecords.find((pulse) => pulse.isActive);

    return NextResponse.json({
      session: {
        code: session.code,
        topic: session.topic,
        isActive: session.isActive,
      },

      activePulse: activePulse
        ? {
            id: activePulse._id.toString(),
            concept: activePulse.concept,
            question: activePulse.question,
            isPaused: Boolean(activePulse.isPaused),
          }
        : null,
    });
  } catch (error) {
    console.error("Session lookup failed:", error);

    return NextResponse.json(
      { error: "Unable to find the session." },
      { status: 500 },
    );
  }
}

// End an active classroom session.
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { code } = await params;
    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid session code." },
        { status: 400 },
      );
    }

    // Verify that the request comes from the classroom teacher.
    const isTeacher = await verifyTeacherAccess(request, normalizedCode);

    if (!isTeacher) {
      return NextResponse.json(
        { error: "Unauthorized. Only the teacher can manage this session." },
        { status: 401 },
      );
    }

    // Only allow the action of ending a session.
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
      !("isActive" in body) ||
      body.isActive !== false
    ) {
      return NextResponse.json(
        { error: "Invalid session action." },
        { status: 400 },
      );
    }

    await connectDB();

    const session = await Session.findOneAndUpdate(
      {
        code: normalizedCode,
        isActive: true,
      },
      {
        $set: { isActive: false },
      },
      {
        returnDocument: "after",
      },
    ).select("code topic isActive");

    if (!session) {
      const existingSession = await Session.findOne({
        code: normalizedCode,
      }).select("code isActive");

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: "This session has already ended." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      message: "Session ended successfully.",
      session: {
        code: session.code,
        topic: session.topic,
        isActive: session.isActive,
      },
    });
  } catch (error) {
    console.error("Session update failed:", error);

    return NextResponse.json(
      { error: "Unable to end session." },
      { status: 500 },
    );
  }
}
