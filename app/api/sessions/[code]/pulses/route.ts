import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";
import { verifyTeacherAccess } from "@/lib/teacher-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type PulseRecord = {
  _id: {
    toString(): string;
  };
  concept: string;
  question: string;
  isActive: boolean;
  isPaused?: boolean;
  createdAt: Date;
  responses: Array<{
    anonymousId: string;
    score: number;
  }>;
};

type ScoreKey = 1 | 2 | 3 | 4 | 5;

//Create a new Pulse.

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { code } = await params;
    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid session code." },
        { status: 400 },
      );
    }

    // Only the classroom teacher can create Pulses.
    const isTeacher = await verifyTeacherAccess(request, normalizedCode);

    if (!isTeacher) {
      return NextResponse.json(
        { error: "Unauthorized. Only the teacher can create Pulses." },
        { status: 401 },
      );
    }

    // Read the new Pulse information.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;

    if (
      typeof payload.concept !== "string" ||
      typeof payload.question !== "string"
    ) {
      return NextResponse.json(
        { error: "Concept and question are required." },
        { status: 400 },
      );
    }

    const concept = payload.concept.trim();
    const question = payload.question.trim();

    if (
      !concept ||
      concept.length > 100 ||
      !question ||
      question.length > 300
    ) {
      return NextResponse.json(
        {
          error:
            "Concept must be 1–100 characters and question 1–300 characters.",
        },
        { status: 400 },
      );
    }

    await connectDB();

    // Find the active classroom.
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

    // Deactivate the previous Pulse, if one exists.
    for (const pulse of session.pulses) {
      pulse.isActive = false;
    }

    // Add the new Pulse.
    session.pulses.push({
      concept,
      question,
      isActive: true,
      responses: [],
    });

    // Save the updated classroom.
    await session.save();

    const newPulse = session.pulses[session.pulses.length - 1];

    return NextResponse.json(
      {
        message: "Pulse created successfully!",
        pulse: {
          id: newPulse._id.toString(),
          concept: newPulse.concept,
          question: newPulse.question,
          isActive: newPulse.isActive,
          totalResponses: newPulse.responses.length,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Pulse creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create Pulse." },
      { status: 500 },
    );
  }
}

// Retrieve Pulse statistics and results

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

    // Only the classroom teacher can view Pulse statistics and results.
    const isTeacher = await verifyTeacherAccess(request, normalizedCode);

    if (!isTeacher) {
      return NextResponse.json(
        { error: "Unauthorized. Only the teacher can view Pulse results." },
        { status: 401 },
      );
    }

    await connectDB();

    const session = await Session.findOne({
      code: normalizedCode,
    }).select("code topic isActive pulses");

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    const pulseRecords = session.pulses as unknown as PulseRecord[];

    const pulses = pulseRecords.map((pulse) => {
      // Count responses for each score.
      const distribution: Record<ScoreKey, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      let totalScore = 0;

      for (const response of pulse.responses) {
        const score = response.score;

        if (Number.isInteger(score) && score >= 1 && score <= 5) {
          distribution[score as ScoreKey]++;
          totalScore += score;
        }
      }

      const totalResponses = pulse.responses.length;

      const averageScore =
        totalResponses > 0
          ? Number((totalScore / totalResponses).toFixed(2))
          : 0;

      return {
        id: pulse._id.toString(),
        concept: pulse.concept,
        question: pulse.question,
        isActive: pulse.isActive,
        isPaused: Boolean(pulse.isPaused),
        totalResponses,
        averageScore,
        distribution,
        createdAt: pulse.createdAt,
      };
    });

    return NextResponse.json({
      session: {
        code: session.code,
        topic: session.topic,
        isActive: session.isActive,
      },
      pulses,
    });
  } catch (error) {
    console.error("Pulse retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve Pulses." },
      { status: 500 },
    );
  }
}
