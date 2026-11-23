import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";

type ActivityResponseRecord = {
  anonymousId: string;
  answer: string;
  submittedAt?: Date;
};

type InterventionRecord = {
  _id: { toString: () => string };
  isActive: boolean;
  activityResponses?: ActivityResponseRecord[];
};

type PulseRecord = {
  _id: { toString: () => string };
  isActive: boolean;
  interventions: InterventionRecord[];
};

type RouteContext = {
  params: Promise<{
    code: string;
    pulseId: string;
    interventionId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { code, pulseId, interventionId } = await params;

    // Read and validate the request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
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

    const anonymousId =
      typeof payload.anonymousId === "string" ? payload.anonymousId.trim() : "";

    const answer =
      typeof payload.answer === "string" ? payload.answer.trim() : "";

    if (anonymousId.length < 10 || anonymousId.length > 100) {
      return NextResponse.json(
        { error: "Invalid anonymous participant ID." },
        { status: 400 },
      );
    }

    if (!answer || answer.length > 3000) {
      return NextResponse.json(
        { error: "Your answer must contain between 1 and 3000 characters." },
        { status: 400 },
      );
    }

    // Connect to MongoDB.
    await connectDB();

    // Find the classroom.
    const session = await Session.findOne({
      code: code.trim().toUpperCase(),
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        { error: "This classroom is unavailable." },
        { status: 404 },
      );
    }

    // Find the Pulse.
    const pulse = session.pulses.find(
      (item: PulseRecord) => item._id.toString() === pulseId,
    );

    if (!pulse || !pulse.isActive) {
      return NextResponse.json(
        { error: "This Pulse is no longer active." },
        { status: 409 },
      );
    }

    // Find the intervention.
    const intervention = pulse.interventions.find(
      (item: InterventionRecord) => item._id.toString() === interventionId,
    );

    if (!intervention || !intervention.isActive) {
      return NextResponse.json(
        { error: "This activity is no longer available." },
        { status: 409 },
      );
    }

    // Prevent the same browser from submitting twice.
    const alreadySubmitted = (intervention.activityResponses ?? []).some(
      (response: ActivityResponseRecord) =>
        response.anonymousId === anonymousId,
    );

    if (alreadySubmitted) {
      return NextResponse.json(
        { error: "You have already submitted an answer to this activity." },
        { status: 409 },
      );
    }

    // Save the anonymous activity response.
    intervention.activityResponses.push({
      anonymousId,
      answer,
    });

    await session.save();

    return NextResponse.json(
      { message: "Your activity answer was submitted successfully." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Activity response submission failed:", error);

    return NextResponse.json(
      { error: "Unable to submit your activity response." },
      { status: 500 },
    );
  }
}
