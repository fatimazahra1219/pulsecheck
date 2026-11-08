
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";
import { verifyTeacherAccess } from "@/lib/teacher-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ code: string }>;
};

type ScoreKey = 1 | 2 | 3 | 4 | 5;

type StudentResponseRecord = {
  score: number;
};

type PulseResultRecord = {
  responses?: StudentResponseRecord[];
};

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

    // Only the classroom teacher can access classroom results.
    const isTeacher = await verifyTeacherAccess(request, normalizedCode);

    if (!isTeacher) {
      return NextResponse.json(
        { error: "Unauthorized. Only the teacher can view classroom results." },
        { status: 401 },
      );
    }

    await connectDB();

    const session = await Session.findOne({
      code: normalizedCode,
    }).select("code topic isActive responses pulses");

    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    }

    // Initialize the overall score distribution.
    const distribution: Record<ScoreKey, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalScore = 0;
    let totalResponses = 0;

    // Add a valid student answer to the overall statistics.
    function addResponse(score: number) {
      if (
        Number.isInteger(score) &&
        score >= 1 &&
        score <= 5
      ) {
        distribution[score as ScoreKey]++;
        totalScore += score;
        totalResponses++;
      }
    }

    // Include older classroom-level responses.
    const legacyResponses =
      session.responses as unknown as StudentResponseRecord[];

    for (const response of legacyResponses ?? []) {
      addResponse(response.score);
    }

    // Include responses from every Pulse.
    const pulseRecords =
      session.pulses as unknown as PulseResultRecord[];

    for (const pulse of pulseRecords ?? []) {
      for (const response of pulse.responses ?? []) {
        addResponse(response.score);
      }
    }

    // Calculate the overall average.
    const averageScore =
      totalResponses > 0
        ? Number((totalScore / totalResponses).toFixed(2))
        : 0;

    return NextResponse.json({
      session: {
        code: session.code,
        topic: session.topic,
        isActive: session.isActive,
      },
      results: {
        totalResponses,
        averageScore,
        distribution,
      },
    });
  } catch (error) {
    console.error("Results retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve results." },
      { status: 500 },
    );
  }
}
