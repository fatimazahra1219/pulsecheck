import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
    pulseId: string;
  }>;
};

type PulseResponseRecord = {
  _id: {
    toString(): string;
  };
  isActive: boolean;
  isPaused?: boolean;
  responses: Array<{
    anonymousId: string;
    score: number;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { code, pulseId } = await params;
    const normalizedCode = code.trim().toUpperCase();

    // Validate classroom code and Pulse ID.
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: "Invalid classroom code." },
        { status: 400 },
      );
    }

    if (
      !/^[a-f0-9]{24}$/i.test(pulseId) ||
      !mongoose.Types.ObjectId.isValid(pulseId)
    ) {
      return NextResponse.json({ error: "Invalid Pulse ID." }, { status: 400 });
    }

    // Read the student's answer.
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
    const anonymousId = payload.anonymousId;
    const score = payload.score;

    // Validate anonymous browser ID.
    if (
      typeof anonymousId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        anonymousId,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid student identifier." },
        { status: 400 },
      );
    }

    // Validate score.
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      return NextResponse.json(
        { error: "Score must be between 1 and 5." },
        { status: 400 },
      );
    }

    await connectDB();

    // Save the response inside the active Pulse.
    const updatedSession = await Session.findOneAndUpdate(
      {
        code: normalizedCode,
        isActive: true,
        pulses: {
          $elemMatch: {
            _id: pulseId,
            isActive: true,
            isPaused: { $ne: true },
            "responses.anonymousId": {
              $ne: anonymousId,
            },
          },
        },
      },
      {
        $push: {
          "pulses.$.responses": {
            anonymousId,
            score,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select("code");

    if (updatedSession) {
      return NextResponse.json(
        {
          message: "Pulse response submitted successfully!",
          response: {
            score,
          },
        },
        { status: 201 },
      );
    }

    // Find out why the update was not performed.
    const existingSession = await Session.findOne({
      code: normalizedCode,
    }).select("isActive pulses");

    const pulseRecords = existingSession
      ? (existingSession.pulses as unknown as PulseResponseRecord[])
      : [];

    if (!existingSession || !existingSession.isActive) {
      return NextResponse.json(
        { error: "Classroom not found or inactive." },
        { status: 404 },
      );
    }

    const pulse = pulseRecords.find((item) => item._id.toString() === pulseId);
    if (!pulse || !pulse.isActive) {
      return NextResponse.json(
        { error: "Pulse not found or no longer active." },
        { status: 404 },
      );
    }

    if (pulse.isPaused) {
      return NextResponse.json(
        {
          error:
            "This Pulse is paused. Please wait for your teacher to resume it.",
        },
        { status: 409 },
      );
    }

    if (pulse.responses.some((item) => item.anonymousId === anonymousId)) {
      return NextResponse.json(
        { error: "You have already answered this Pulse." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to submit your response." },
      { status: 409 },
    );
  } catch (error) {
    console.error("Pulse response submission failed:", error);

    return NextResponse.json(
      { error: "Unable to submit response." },
      { status: 500 },
    );
  }
}
