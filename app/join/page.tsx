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

          {/* ---------- Joined, waiting for a Pulse ---------- */}
          {session && !sessionEnded && !activePulse && (
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

              {/* Scale */}
              <div
                role="radiogroup"
                aria-label="Your understanding level"
                className="mt-6 space-y-2.5"
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
                          {
                            [
                              "Totally lost",
                              "Not really",
                              "Getting there",
                              "Mostly got it",
                              "Completely got it",
                            ][value - 1]
                          }
                        </span>
                        <span className="block text-sm text-slate-500">
                          {
                            [
                              "I need this explained again",
                              "I am confused about parts of it",
                              "I understand some of it",
                              "I only have small questions",
                              "I could teach this to someone",
                            ][value - 1]
                          }
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

              {responseError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {responseError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmitResponse}
                disabled={activePulse.isPaused || submitting || score === null}
                className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {activePulse.isPaused
                  ? "Waiting for your teacher..."
                  : submitting
                    ? "Sending..."
                    : score === null
                      ? "Pick an answer"
                      : "Send my answer"}
              </button>

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
