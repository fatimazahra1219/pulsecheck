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
  isPaused: boolean;
};

type JoinResponse = {
  session?: Session;
  activePulse?: ActivePulse | null;
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

  const [score, setScore] = useState<number | null>(null);

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
    setSubmitted(false);
    setResponseError("");

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(code.trim().toUpperCase())}`,
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
    if (!session || !activePulse || activePulse.isPaused || score === null) {
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
        const response = await fetch(`/api/sessions/${sessionCode}`);

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
          setResponseError("");

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
    setSubmitted(false);
    setError("");
    setResponseError("");
    setSessionEnded(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
            P
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">PulseCheck</h1>

          <p className="mt-2 text-sm text-slate-500">
            Classroom understanding check
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {/* Join classroom */}
          {!session && (
            <>
              <h2 className="text-xl font-bold">Join your classroom</h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter the code provided by your teacher.
              </p>

              <form onSubmit={handleJoin} className="mt-7">
                <label
                  htmlFor="code"
                  className="mb-2 block text-sm font-semibold"
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
                  placeholder="E.g. F2YVBA"
                  maxLength={6}
                  required
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-xl font-bold tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Checking session..." : "Join session"}
                </button>
              </form>
            </>
          )}

          {/* Classroom has ended */}
          {session && sessionEnded && (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
                ✓
              </div>

              <h2 className="mt-4 text-xl font-bold">Classroom ended</h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Your teacher has ended this classroom session. Thank you for
                participating!
              </p>

              <button
                type="button"
                onClick={resetJoin}
                className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Back to join
              </button>
            </div>
          )}

          {/* Classroom found, but no active Pulse */}
          {session && !sessionEnded && !activePulse && (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
                …
              </div>

              <h2 className="mt-4 text-xl font-bold">No active question yet</h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                Your teacher hasn&apos;t started an understanding check. Please
                wait for the teacher to create a Pulse.
              </p>

              <button
                type="button"
                onClick={resetJoin}
                className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Back to join
              </button>
            </div>
          )}

          {/* Pulse already answered */}
          {session && !sessionEnded && activePulse && submitted && (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
                ✓
              </div>

              <h2 className="mt-5 text-xl font-bold">Response submitted!</h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Thank you for sharing your understanding. Your response has been
                saved.
              </p>

              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-medium">
                {activePulse.concept}
              </p>
            </div>
          )}

          {/* Active Pulse question */}
          {session && !sessionEnded && activePulse && !submitted && (
            <>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activePulse.isPaused
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {activePulse.isPaused
                  ? "Question paused"
                  : "Active understanding check"}
              </span>

              <p className="mt-5 text-sm text-slate-500">{session.topic}</p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {activePulse.concept}
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-600">
                {activePulse.question}
              </p>

              {activePulse.isPaused && (
                <p
                  role="status"
                  className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800"
                >
                  Your teacher has paused this question. You can submit your
                  answer when the teacher resumes it.
                </p>
              )}

              <p className="mt-7 text-sm font-semibold">
                Select your understanding level:
              </p>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScore(value)}
                    disabled={activePulse.isPaused || submitting}
                    aria-pressed={score === value}
                    className={`rounded-xl border py-4 text-lg font-bold transition ${
                      activePulse.isPaused
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : score === value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-xs text-slate-500">
                <span>1 — Don&apos;t understand</span>
                <span>5 — Completely</span>
              </div>

              {responseError && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {responseError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmitResponse}
                disabled={activePulse.isPaused || submitting || score === null}
                className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {activePulse.isPaused
                  ? "Waiting for teacher..."
                  : submitting
                    ? "Submitting..."
                    : "Submit my answer"}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          PulseCheck · Learn, understand, improve.
        </p>
      </div>
    </main>
  );
}
