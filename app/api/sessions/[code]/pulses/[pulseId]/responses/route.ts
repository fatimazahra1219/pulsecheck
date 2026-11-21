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
  mode?: "rating" | "knowledge_check";
  answerOptions?: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId?: string;
  isActive: boolean;
  isPaused?: boolean;
  responses: Array<{
    anonymousId: string;
    score: number;
    selectedOptionId?: string;
    isCorrect?: boolean;
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

    // Load the Pulse to determine its mode and validate the answer.
    const sessionForValidation = await Session.findOne({
      code: normalizedCode,
    }).select("isActive pulses");

    if (!sessionForValidation || !sessionForValidation.isActive) {
      return NextResponse.json(
        { error: "Classroom not found or inactive." },
        { status: 404 },
      );
    }

    const validationPulseRecords =
      sessionForValidation.pulses as unknown as PulseResponseRecord[];

    const validationPulse = validationPulseRecords.find(
      (item) => item._id.toString() === pulseId,
    );

    if (!validationPulse || !validationPulse.isActive) {
      return NextResponse.json(
        { error: "Pulse not found or no longer active." },
        { status: 404 },
      );
    }

    if (validationPulse.isPaused) {
      return NextResponse.json(
        {
          error:
            "This Pulse is paused. Please wait for your teacher to resume it.",
        },
        { status: 409 },
      );
    }

    if (
      (validationPulse.responses ?? []).some(
        (item) => item.anonymousId === anonymousId,
      )
    ) {
      return NextResponse.json(
        { error: "You have already answered this Pulse." },
        { status: 409 },
      );
    }

    // Old Pulses without a mode are treated as rating Pulses.
    const mode = validationPulse.mode ?? "rating";

    // Prepare the response. Correctness is calculated by the server.
    let responseToSave: {
      anonymousId: string;
      score: number;
      selectedOptionId?: string;
      isCorrect?: boolean;
    } = {
      anonymousId,
      score,
    };

    if (mode === "knowledge_check") {
      if (typeof payload.selectedOptionId !== "string") {
        return NextResponse.json(
          { error: "Please select an answer option." },
          { status: 400 },
        );
      }

      const selectedOptionId = payload.selectedOptionId.trim();
      const answerOptions = validationPulse.answerOptions ?? [];
      const correctOptionId = validationPulse.correctOptionId;

      // Check that the question has a valid answer configuration.
      if (
        !correctOptionId ||
        !answerOptions.some((option) => option.id === correctOptionId)
      ) {
        return NextResponse.json(
          {
            error:
              "This knowledge check is not configured correctly. Please ask your teacher to recreate it.",
          },
          { status: 409 },
        );
      }

      // The selected answer must belong to this Pulse.
      if (!answerOptions.some((option) => option.id === selectedOptionId)) {
        return NextResponse.json(
          { error: "Invalid answer option." },
          { status: 400 },
        );
      }

      const isCorrect = selectedOptionId === correctOptionId;

      responseToSave = {
        anonymousId,
        score,
        selectedOptionId,
        isCorrect,
      };
    } else if (mode !== "rating") {
      return NextResponse.json(
        { error: "This Pulse has an invalid mode." },
        { status: 409 },
      );
    } else if (payload.selectedOptionId !== undefined) {
      return NextResponse.json(
        { error: "This rating Pulse does not accept answer options." },
        { status: 400 },
      );
    }

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
          "pulses.$.responses": responseToSave,
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
