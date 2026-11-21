"use client";

import { useEffect, useState, type FormEvent } from "react";

type Session = {
  code: string;
  topic: string;
  isActive: boolean;
};

type ActivePulse = {
  id: string;
  concept: string;
  question: string;
  mode: "rating" | "knowledge_check";
  answerOptions: Array<{
    id: string;
    text: string;
  }>;
  isPaused: boolean;
};

type StudentFeedback = {
  pulseId: string;
  concept: string;
  question: string;
  answerOptions: Array<{
    id: string;
    text: string;
  }>;
  selectedOptionId?: string;
  confidenceScore: number;
  isCorrect: boolean;
  correctOptionId: string;
  explanation: string;
};

type JoinResponse = {
  session?: Session;
  activePulse?: ActivePulse | null;
  feedback?: StudentFeedback | null;
  error?: string;
};

type SubmitResponse = {
  message?: string;
  error?: string;
};

export default function JoinPage() {
  const [code, setCode] = useState("");

  const [session, setSession] = useState<Session | null>(null);
  const [activePulse, setActivePulse] = useState<ActivePulse | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState<StudentFeedback | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const [knowledgeStep, setKnowledgeStep] = useState<"answer" | "confidence">(
    "answer",
  );

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [error, setError] = useState("");
  const [responseError, setResponseError] = useState("");

  const sessionCode = session?.code;

  // Join the classroom and retrieve its active Pulse.
  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSession(null);
    setActivePulse(null);
    setScore(null);
    setSelectedOptionId(null);
    setKnowledgeStep("answer");
    setSubmitted(false);
    setResponseError("");

    try {
      const anonymousId = localStorage.getItem("pulsecheck-anonymous-id");

      const response = await fetch(
        `/api/sessions/${encodeURIComponent(code.trim().toUpperCase())}`,
        {
          headers: anonymousId
            ? { "x-pulsecheck-anonymous-id": anonymousId }
            : {},
        },
      );

      const data: JoinResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to join session.");
      }

      if (!data.session) {
        throw new Error("Invalid server response.");
      }

      setSession(data.session);
      setActivePulse(data.activePulse ?? null);
      setFeedback(data.feedback ?? null);

      // Check whether this browser already answered this Pulse.
      if (data.activePulse) {
        const storageKey = `pulsecheck-submitted:${data.session.code}:${data.activePulse.id}`;

        setSubmitted(localStorage.getItem(storageKey) === "true");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Submit an answer to the specific active Pulse.
  async function handleSubmitResponse() {
    if (
      !session ||
      !activePulse ||
      activePulse.isPaused ||
      score === null ||
      (activePulse.mode === "knowledge_check" &&
        (selectedOptionId === null || knowledgeStep !== "confidence"))
    ) {
      return;
    }
    setSubmitting(true);
    setResponseError("");

    try {
      // Get or create the anonymous browser identifier.
      let anonymousId = localStorage.getItem("pulsecheck-anonymous-id");

      if (!anonymousId) {
        anonymousId = crypto.randomUUID();

        localStorage.setItem("pulsecheck-anonymous-id", anonymousId);
      }

      // Submit to the Pulse-specific endpoint.
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(session.code)}/pulses/${encodeURIComponent(activePulse.id)}/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            anonymousId,
            score,
            ...(activePulse.mode === "knowledge_check" &&
            selectedOptionId !== null
              ? { selectedOptionId }
              : {}),
          }),
        },
      );

      const data: SubmitResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit your answer.");
      }

      // Remember the submission for this particular Pulse.
      const storageKey = `pulsecheck-submitted:${session.code}:${activePulse.id}`;

      localStorage.setItem(storageKey, "true");

      setSubmitted(true);
    } catch (err: unknown) {
      setResponseError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!sessionCode || sessionEnded) return;

    let cancelled = false;
    let requestInProgress = false;

    async function checkForUpdates() {
      if (requestInProgress || cancelled) return;

      requestInProgress = true;

      try {
        const anonymousId = localStorage.getItem("pulsecheck-anonymous-id");

        const response = await fetch(`/api/sessions/${sessionCode}`, {
          headers: anonymousId
            ? { "x-pulsecheck-anonymous-id": anonymousId }
            : {},
        });

        // The classroom has ended or is no longer available.
        if (response.status === 404) {
          if (!cancelled) {
            setSessionEnded(true);
            setActivePulse(null);
            setSubmitted(false);
          }
          return;
        }

        const data: JoinResponse = await response.json();

        if (!response.ok || !data.session) {
          throw new Error(data.error || "Unable to check for updates.");
        }

        if (cancelled) return;

        const nextPulse = data.activePulse ?? null;
        setFeedback(data.feedback ?? null);

        setSessionEnded(false);

        // Has the teacher started a different Pulse?
        const pulseChanged = nextPulse?.id !== activePulse?.id;

        // Has the teacher paused or resumed the same Pulse?
        const pauseStatusChanged =
          nextPulse?.isPaused !== activePulse?.isPaused;

        // Update the student page when the Pulse or its pause status changes.
        if (pulseChanged || pauseStatusChanged) {
          setActivePulse(nextPulse);
        }

        // Only reset the student's answer when a different Pulse starts.
        if (pulseChanged) {
          setScore(null);
          setSelectedOptionId(null);
          setResponseError("");
          setKnowledgeStep("answer");

          if (nextPulse) {
            const storageKey = `pulsecheck-submitted:${sessionCode}:${nextPulse.id}`;

            setSubmitted(localStorage.getItem(storageKey) === "true");
          } else {
            setSubmitted(false);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Session refresh failed:", error);
        }
      } finally {
        requestInProgress = false;
      }
    }

    // Check every 3 seconds.
    const interval = window.setInterval(() => {
      void checkForUpdates();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode, activePulse?.id, activePulse?.isPaused, sessionEnded]);

  function resetJoin() {
    setSession(null);
    setActivePulse(null);
    setCode("");
    setScore(null);
    setSelectedOptionId(null);
    setKnowledgeStep("answer");
    setSubmitted(false);
    setError("");
    setResponseError("");
    setSessionEnded(false);
    setFeedback(null);
  }

  // Different labels for understanding and confidence.
  const scaleLabels =
    activePulse?.mode === "knowledge_check"
      ? [
          "Not confident at all",
          "A little confident",
          "Not sure",
          "Confident",
          "Very confident",
        ]
      : [
          "Totally lost",
          "Not really",
          "Getting there",
          "Mostly got it",
          "Completely got it",
        ];

  const scaleDescriptions =
    activePulse?.mode === "knowledge_check"
      ? [
          "I'm mostly guessing",
          "I have doubts about my answer",
          "I could be right, but I'm unsure",
          "I believe my answer is correct",
          "I'm certain and can explain why",
        ]
      : [
          "I need this explained again",
          "I am confused about parts of it",
          "I understand some of it",
          "I only have small questions",
          "I could teach this to someone",
        ];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f6f6fb] px-4 py-6 text-slate-900 antialiased sm:py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
              </svg>
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              PulseCheck
            </span>
          </div>

          {session && !sessionEnded && (
            <button
              type="button"
              onClick={resetJoin}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              Leave
            </button>
          )}
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          {/* ---------- Join classroom ---------- */}
          {!session && (
            <section>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-950">
                Join your class
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-500">
                Type the 6-character code from your teacher. No name or account
                needed.
              </p>

              <form
                onSubmit={handleJoin}
                className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6"
              >
                <label
                  htmlFor="code"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Classroom code
                </label>

                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 6),
                    )
                  }
                  placeholder="F2YVBA"
                  maxLength={6}
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-5 text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-indigo-950 outline-none transition placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />

                {error && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? "Checking code..." : "Join class"}
                </button>
              </form>
            </section>
          )}

          {/* ---------- Classroom has ended ---------- */}
          {session && sessionEnded && (
            <section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl"
                aria-hidden="true"
              >
                👋
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
                Class is over
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-500">
                Your teacher ended this session. Thanks for taking part!
              </p>
              <button
                type="button"
                onClick={resetJoin}
                className="mt-7 w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-bold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Join another class
              </button>
            </section>
          )}

          {/* ---------- Post-Pulse learning feedback ---------- */}
          {session && !sessionEnded && feedback && !activePulse && (
            <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-indigo-600">
                  Your learning feedback
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    feedback.isCorrect
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {feedback.isCorrect ? "Correct answer ✓" : "Not quite"}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-extrabold text-slate-950">
                {feedback.concept}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {feedback.question}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Your confidence
                  </p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {feedback.confidenceScore}/5
                  </p>
                </div>

                <div
                  className={`rounded-xl p-4 ${
                    feedback.isCorrect ? "bg-emerald-50" : "bg-amber-50"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500">
                    Your result
                  </p>
                  <p className="mt-1 text-lg font-extrabold">
                    {feedback.isCorrect ? "Correct" : "Incorrect"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Your answer
                  </p>
                  <p className="mt-2 font-semibold text-slate-800">
                    {feedback.answerOptions.find(
                      (option) => option.id === feedback.selectedOptionId,
                    )?.text ?? "Not available"}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                    Correct answer
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {feedback.answerOptions.find(
                      (option) => option.id === feedback.correctOptionId,
                    )?.text ?? "Not available"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-indigo-50 p-4">
                <h3 className="font-bold text-indigo-950">
                  Why is this correct?
                </h3>
                <p className="mt-2 text-sm leading-6 text-indigo-900">
                  {feedback.explanation}
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {feedback.isCorrect
                    ? feedback.confidenceScore >= 4
                      ? "Excellent! Your confidence matched your knowledge."
                      : "You got it right! You might know more than you think."
                    : feedback.confidenceScore >= 4
                      ? "You felt confident, but this question revealed something worth revisiting."
                      : "This concept may need more practice. That's exactly what this check is designed to reveal."}
                </p>
              </div>
            </section>
          )}

          {/* ---------- Joined, waiting for a Pulse ---------- */}
          {session && !sessionEnded && !activePulse && !feedback && (
            <section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping motion-reduce:animate-none rounded-full bg-indigo-200 motion-reduce:animate-none" />
                <span
                  className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl"
                  aria-hidden="true"
                >
                  ⏳
                </span>
              </div>
              <p className="mt-6 text-sm font-semibold text-indigo-600">
                You are in {session.topic}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                Waiting for a question
              </h2>
              <p
                role="status"
                className="mt-2 text-base leading-7 text-slate-500"
              >
                Your teacher has not asked anything yet. Keep this page open and
                it will appear here by itself.
              </p>
            </section>
          )}

          {/* ---------- Already answered ---------- */}
          {session && !sessionEnded && activePulse && submitted && (
            <section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700"
                aria-hidden="true"
              >
                ✓
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
                Answer sent
              </h2>
              <p className="mt-2 text-base leading-7 text-slate-500">
                Thanks for sharing your understanding. Your teacher sees the
                classroom results, not your name.
              </p>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
                <p className="text-sm text-slate-500">You answered about</p>
                <p className="mt-1 font-bold text-slate-900">
                  {activePulse.concept}
                </p>
                {score !== null && (
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {["😵", "😕", "😐", "🙂", "🤩"][score - 1]} {score} out of 5
                  </p>
                )}
              </div>

              <p
                role="status"
                className="mt-6 text-sm leading-6 text-slate-500"
              >
                Stay on this page. The next question will show up automatically.
              </p>
            </section>
          )}

          {/* ---------- Active question ---------- */}
          {session && !sessionEnded && activePulse && !submitted && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-500">
                  {session.topic}
                </p>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    activePulse.isPaused
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      activePulse.isPaused
                        ? "bg-amber-500"
                        : "animate-pulse bg-emerald-500"
                    }`}
                  />
                  {activePulse.isPaused ? "Paused" : "Live question"}
                </span>
              </div>

              <h1 className="mt-4 break-words text-3xl font-extrabold leading-tight tracking-tight text-slate-950">
                {activePulse.concept}
              </h1>
              <p className="mt-2 text-lg leading-7 text-slate-600">
                {activePulse.question}
              </p>

              {activePulse.isPaused && (
                <p
                  role="status"
                  className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900 ring-1 ring-amber-200"
                >
                  Your teacher paused this question. You can answer as soon as
                  it is resumed.
                </p>
              )}

              {/* Knowledge check answer options */}

              {/* STEP 1: Choose an answer first */}
              {activePulse.mode === "knowledge_check" &&
                knowledgeStep === "answer" && (
                  <div className="mt-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Step 1 of 2
                    </p>

                    <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                      Choose your answer
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Read the options and select the answer you believe is
                      correct.
                    </p>

                    <div
                      role="radiogroup"
                      aria-label="Answer options"
                      className="mt-4 space-y-3"
                    >
                      {activePulse.answerOptions.map((option, index) => {
                        const selected = selectedOptionId === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setSelectedOptionId(option.id)}
                            disabled={activePulse.isPaused || submitting}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                              selected
                                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                                : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                                selected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                              aria-hidden="true"
                            >
                              {String.fromCharCode(65 + index)}
                            </span>

                            <span className="flex-1 text-sm font-semibold text-slate-800">
                              {option.text}
                            </span>

                            {selected && (
                              <span
                                className="font-bold text-indigo-600"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setKnowledgeStep("confidence")}
                      disabled={
                        activePulse.isPaused ||
                        submitting ||
                        selectedOptionId === null
                      }
                      className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to confidence →
                    </button>
                  </div>
                )}

              {/* STEP 2: Rate confidence after choosing an answer */}
              {(activePulse.mode === "rating" ||
                knowledgeStep === "confidence") && (
                <div className="mt-6">
                  {activePulse.mode === "knowledge_check" && (
                    <>
                      <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          Your selected answer
                        </p>

                        <p className="mt-2 font-bold text-slate-900">
                          {
                            activePulse.answerOptions.find(
                              (option) => option.id === selectedOptionId,
                            )?.text
                          }
                        </p>
                      </div>

                      <div className="mt-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                          Step 2 of 2
                        </p>

                        <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                          How confident are you?
                        </h2>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          How sure are you that your selected answer is correct?
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setKnowledgeStep("answer");
                          setScore(null);
                        }}
                        disabled={activePulse.isPaused || submitting}
                        className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                      >
                        ← Change my answer
                      </button>
                    </>
                  )}

                  <div
                    role="radiogroup"
                    aria-label={
                      activePulse.mode === "knowledge_check"
                        ? "Your confidence level"
                        : "Your understanding level"
                    }
                    className="mt-4 space-y-2.5"
                  >
                    {[1, 2, 3, 4, 5].map((value) => {
                      const selected = score === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setScore(value)}
                          disabled={activePulse.isPaused || submitting}
                          className={`flex w-full items-center gap-4 rounded-2xl p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? [
                                  "bg-rose-50 ring-2 ring-rose-500",
                                  "bg-orange-50 ring-2 ring-orange-400",
                                  "bg-amber-50 ring-2 ring-amber-400",
                                  "bg-lime-50 ring-2 ring-lime-500",
                                  "bg-emerald-50 ring-2 ring-emerald-500",
                                ][value - 1]
                              : "bg-white ring-1 ring-slate-200 hover:ring-slate-400 active:scale-[0.99]"
                          }`}
                        >
                          <span
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-2xl"
                            aria-hidden="true"
                          >
                            {["😵", "😕", "😐", "🙂", "🤩"][value - 1]}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-bold text-slate-900">
                              {scaleLabels[value - 1]}
                            </span>

                            <span className="block text-sm text-slate-500">
                              {scaleDescriptions[value - 1]}
                            </span>
                          </span>

                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              selected
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                            aria-hidden="true"
                          >
                            {selected ? "✓" : value}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {responseError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {responseError}
                </p>
              )}

              {(activePulse.mode === "rating" ||
                knowledgeStep === "confidence") && (
                <button
                  type="button"
                  onClick={handleSubmitResponse}
                  disabled={
                    activePulse.isPaused ||
                    submitting ||
                    score === null ||
                    (activePulse.mode === "knowledge_check" &&
                      selectedOptionId === null)
                  }
                  className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {activePulse.isPaused
                    ? "Waiting for your teacher..."
                    : submitting
                      ? "Sending..."
                      : score === null
                        ? "Rate your confidence"
                        : activePulse.mode === "knowledge_check" &&
                            selectedOptionId === null
                          ? "Choose an answer"
                          : "Send my answer"}
                </button>
              )}

              <p className="mt-3 text-center text-xs text-slate-500">
                Your answer is anonymous. Your teacher only sees the totals.
              </p>
            </section>
          )}
        </div>

        <footer className="pb-2 text-center text-xs text-slate-400">
          PulseCheck. Anonymous feedback, better lessons.
        </footer>
      </div>
    </main>
  );
}
