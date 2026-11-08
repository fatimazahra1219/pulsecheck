import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Session from "@/lib/models/Session";
import { createHash, randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { verifyTeacherAccess } from "@/lib/teacher-auth";

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("topic" in body) ||
      typeof body.topic !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid topic is required." },
        { status: 400 },
      );
    }

    const topic = body.topic.trim();

    if (!topic || topic.length > 100) {
      return NextResponse.json(
        { error: "Topic must contain between 1 and 100 characters." },
        { status: 400 },
      );
    }

    // Connect to MongoDB.
    await connectDB();

    // Generate a six-character classroom code.
    const code = generateCode();

    // Generate a private teacher management key.
    const teacherKey = randomBytes(32).toString("hex");

    // Store only the SHA-256 hash in MongoDB.
    const teacherKeyHash = createHash("sha256")
      .update(teacherKey)
      .digest("hex");

    // Save the session in MongoDB.
    const session = await Session.create({
      code,
      topic,
      isActive: true,
      teacherKeyHash,
    });

    // Prepare the response.
    const response = NextResponse.json(
      {
        message: "Session created successfully!",
        session: {
          code: session.code,
          topic: session.topic,
          isActive: session.isActive,
        },
      },
      { status: 201 },
    );

    // Give the browser the private key through an HTTP-only cookie.
    // The cookie is restricted to this classroom's API routes.
    response.cookies.set({
      name: `pulsecheck_teacher_${code}`,
      value: teacherKey,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/sessions",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("Session creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create session." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    await connectDB();

    // Extract classroom codes from teacher cookie names.
    const cookieHeader = request.headers.get("cookie") ?? "";

    const sessionCodes = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("=")[0])
      .map(
        (cookieName) =>
          cookieName.match(/^pulsecheck_teacher_([A-Z0-9]{6})$/)?.[1],
      )
      .filter((code): code is string => Boolean(code));

    const uniqueSessionCodes = [...new Set(sessionCodes)];

    // No teacher cookies means no classroom history.
    if (uniqueSessionCodes.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Retrieve only classrooms associated with these cookie names.
    const sessions = await Session.aggregate([
      {
        $match: {
          code: { $in: uniqueSessionCodes },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: 20,
      },
      {
        $project: {
          _id: 0,
          code: 1,
          topic: 1,
          isActive: 1,
          createdAt: 1,
          totalResponses: {
            $add: [
              {
                $size: {
                  $ifNull: ["$responses", []],
                },
              },
              {
                $reduce: {
                  input: {
                    $ifNull: ["$pulses", []],
                  },
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $size: {
                          $ifNull: ["$$this.responses", []],
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ]);

    // Verify each classroom's actual secret key.
    const authorizedSessions = [];

    for (const session of sessions) {
      const isTeacher = await verifyTeacherAccess(request, session.code);

      if (isTeacher) {
        authorizedSessions.push(session);
      }
    }

    return NextResponse.json({
      sessions: authorizedSessions,
    });
  } catch (error) {
    console.error("Session history retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve session history." },
      { status: 500 },
    );
  }
}
