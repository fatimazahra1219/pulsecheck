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
  mode?: "rating" | "knowledge_check";
  interventions?: Array<{
    _id: {
      toString(): string;
    };
    title: string;
    instructions: string;
    teacherMaterial?: string;
    isActive: boolean;
  }>;
  answerOptions?: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId?: string;
  explanation?: string;
  isActive: boolean;
  isPaused?: boolean;
  createdAt: Date;
  responses: Array<{
    anonymousId: string;
    score: number;
    selectedOptionId?: string;
    isCorrect?: boolean;
  }>;
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
    // Identify the student using their anonymous browser ID.
    const anonymousId = request.headers.get("x-pulsecheck-anonymous-id");

    const validAnonymousId =
      typeof anonymousId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        anonymousId,
      );

    // Find the latest completed Knowledge Check answered by this student.
    // Find the most recently created Pulse in the classroom.
    const latestPulse = [...pulseRecords].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

    // Feedback belongs only to the most recent Pulse.
    // It is available only after that Pulse has ended.
    const completedPulse =
      validAnonymousId &&
      latestPulse &&
      !latestPulse.isActive &&
      latestPulse.mode === "knowledge_check"
        ? latestPulse
        : undefined;

    // Find this student's response to that specific Pulse.
    const studentResponse = completedPulse?.responses.find(
      (response) =>
        response.anonymousId === anonymousId &&
        typeof response.isCorrect === "boolean",
    );

    // Release feedback only after completion and only to a student who answered.
    const feedback =
      completedPulse &&
      studentResponse &&
      completedPulse.correctOptionId &&
      completedPulse.explanation
        ? {
            pulseId: completedPulse._id.toString(),
            concept: completedPulse.concept,
            question: completedPulse.question,
            answerOptions: completedPulse.answerOptions ?? [],
            selectedOptionId: studentResponse.selectedOptionId,
            confidenceScore: studentResponse.score,
            isCorrect: studentResponse.isCorrect,
            correctOptionId: completedPulse.correctOptionId,
            explanation: completedPulse.explanation,
          }
        : null;

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
            mode: activePulse.mode ?? "rating",
            answerOptions:
              activePulse.mode === "knowledge_check"
                ? (activePulse.answerOptions ?? [])
                : [],
            isPaused: Boolean(activePulse.isPaused),

            activeIntervention:
              (activePulse.interventions ?? [])
                .filter((intervention) => intervention.isActive)
                .map((intervention) => ({
                  id: intervention._id.toString(),
                  title: intervention.title,
                  instructions: intervention.instructions,
                  teacherMaterial: intervention.teacherMaterial ?? "",
                }))[0] ?? null,
          }
        : null,
      feedback,
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
