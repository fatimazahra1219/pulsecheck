"use client";

import { useEffect, useState, type FormEvent } from "react";

type Session = {
  code: string;
  topic: string;
  isActive: boolean;
};

type SessionHistoryItem = Session & {
  createdAt: string;
  totalResponses: number;
};

type PulseDistribution = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
};

type Pulse = {
  id: string;
  concept: string;
  question: string;
  isActive: boolean;
  isPaused: boolean;
  totalResponses: number;
  averageScore: number;
  distribution: PulseDistribution;
  createdAt: string;
};
type Distribution = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
};

type Results = {
  totalResponses: number;
  averageScore: number;
  distribution: Distribution;
};

type CreateSessionResponse = {
  message?: string;
  session?: Session;
  error?: string;
};

type ResultsResponse = {
  results?: Results;
  error?: string;
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [results, setResults] = useState<Results | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  const [resultsError, setResultsError] = useState("");

  const sessionCode = session?.code;

  // Pulse form
  const [concept, setConcept] = useState("");
  const [question, setQuestion] = useState("");

  // Existing Pulses
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [pulsesLoading, setPulsesLoading] = useState(true);

  // Loading and errors
  const [creatingPulse, setCreatingPulse] = useState(false);
  const [pulsesError, setPulsesError] = useState("");

  // Refresh Pulses
  const [pulseRefresh, setPulseRefresh] = useState(0);

  // End pulses
  const [endingPulseId, setEndingPulseId] = useState<string | null>(null);
  const [updatingPulseId, setUpdatingPulseId] = useState<string | null>(null);
  const [pulseActionError, setPulseActionError] = useState("");

  // Create a classroom session.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSession(null);
    setResults(null);
    setResultsError("");

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic.trim(),
        }),
      });

      const data: CreateSessionResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create session.");
      }

      if (!data.session) {
        throw new Error("Invalid server response.");
      }

      setSession(data.session);
      setHistoryRefresh((current) => current + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEndSession() {
    if (!session || !session.isActive) return;

    const confirmed = window.confirm(
      "Are you sure you want to end this session? Students will no longer be able to join or submit answers.",
    );

    if (!confirmed) return;

    setEnding(true);
    setEndError("");

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(session.code)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: false,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to end session.");
      }

      setSession(data.session);
      setHistoryRefresh((current) => current + 1);
    } catch (err: unknown) {
      setEndError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setEnding(false);
    }
  }

  //sending the teacher's information to the backend.

  async function handleCreatePulse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !session.isActive) return;

    setCreatingPulse(true);
    setPulsesError("");

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(session.code)}/pulses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            concept: concept.trim(),
            question: question.trim(),
          }),
        },
      );

      const data: {
        pulse?: Pulse;
        error?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create Pulse.");
      }

      // Clear the form.
      setConcept("");
      setQuestion("");

      // Retrieve the updated Pulse list.
      setPulseRefresh((current) => current + 1);
    } catch (err: unknown) {
      setPulsesError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setCreatingPulse(false);
    }
  }

  async function handleEndPulse(pulseId: string) {
    if (!session) return;

    const confirmed = window.confirm(
      "Are you sure you want to end this Pulse? Students will no longer be able to submit answers to it.",
    );

    if (!confirmed) return;

    setEndingPulseId(pulseId);
    setPulseActionError("");

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(session.code)}/pulses/${encodeURIComponent(pulseId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "end",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to end Pulse.");
      }

      // Retrieve updated Pulse information.
      setPulseRefresh((current) => current + 1);
    } catch (err: unknown) {
      setPulseActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setEndingPulseId(null);
    }
  }

  async function handlePauseResumePulse(
    pulseId: string,
    action: "pause" | "resume",
  ) {
    if (!sessionCode) return;

    setUpdatingPulseId(pulseId);
    setPulseActionError("");

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(sessionCode)}/pulses/${encodeURIComponent(pulseId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Unable to ${action} Pulse.`);
      }

      // Refresh Pulse information to display its new status.
      setPulseRefresh((current) => current + 1);
    } catch (err: unknown) {
      setPulseActionError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setUpdatingPulseId(null);
    }
  }
  // Automatically retrieve results every 3 seconds.
  useEffect(() => {
    if (!sessionCode) return;

    let cancelled = false;

    async function loadResults() {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionCode!)}/results`,
          { cache: "no-store" },
        );

        const data: ResultsResponse = await response.json();

        if (!response.ok || !data.results) {
          throw new Error(data.error || "Unable to load results.");
        }

        if (!cancelled) {
          setResults(data.results);
          setResultsError("");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setResultsError(
            err instanceof Error ? err.message : "Unable to load results.",
          );
        }
      }
    }

    // Load results immediately.
    void loadResults();

    // Then refresh every 3 seconds.
    const interval = window.setInterval(() => {
      void loadResults();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch("/api/sessions", {
          cache: "no-store",
        });

        const data: {
          sessions?: SessionHistoryItem[];
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load sessions.");
        }

        if (!cancelled) {
          setSessions(data.sessions ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "Unable to load session history.",
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [historyRefresh]);

  // pulses Whenever a teacher selects a classroom, React requests its Pulses

  useEffect(() => {
    if (!sessionCode) return;

    let cancelled = false;

    async function loadPulses() {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionCode!)}/pulses`,
          { cache: "no-store" },
        );

        const data: {
          pulses?: Pulse[];
          error?: string;
        } = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load Pulses.");
        }

        if (!cancelled) {
          setPulses(data.pulses ?? []);
          setPulsesError("");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setPulsesError(
            err instanceof Error ? err.message : "Unable to load Pulses.",
          );
        }
      } finally {
        if (!cancelled) {
          setPulsesLoading(false);
        }
      }
    }

    // First request immediately.
    void loadPulses();

    // Refresh Pulse statistics every 3 seconds.
    const interval = window.setInterval(() => {
      void loadPulses();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionCode, pulseRefresh]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <span className="text-xl font-bold">P</span>
            </div>

            <div>
              <h1 className="text-lg font-bold">PulseCheck</h1>
              <p className="text-xs text-slate-500">
                Classroom feedback platform
              </p>
            </div>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
            Teacher dashboard
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Page introduction */}
        <section>
          <p className="mb-2 text-sm font-semibold text-blue-600">
            YOUR CLASSROOM
          </p>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Understand your students better.
          </h2>

          <p className="mt-3 max-w-xl leading-7 text-slate-500">
            Create a session, share its code with your students, and discover
            how well they understand your lesson.
          </p>
        </section>

        {/* Create session */}
        <section className="mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">Create a new session</h3>

          <p className="mt-1 text-sm text-slate-500">
            Enter the topic you&apos;re teaching.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="topic" className="mb-2 block text-sm font-semibold">
              Lesson topic
            </label>

            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. JavaScript - Array Methods"
              maxLength={100}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating session..." : "Create session"}
            </button>
          </form>
        </section>

        {/* Previous classroom sessions */}
        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">My classroom sessions</h3>

              <p className="mt-1 text-sm text-slate-500">
                Review your previous lessons and results.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setHistoryRefresh((current) => current + 1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {historyError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {historyError}
            </p>
          )}

          {historyLoading ? (
            <p className="mt-6 text-sm text-slate-500">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No sessions created yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {sessions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() =>
                    setSession({
                      code: item.code,
                      topic: item.topic,
                      isActive: item.isActive,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-800">{item.topic}</h4>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.isActive ? "Active" : "Ended"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                    <span>
                      Code: <strong>{item.code}</strong>
                    </span>

                    <span>{item.totalResponses} responses</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>

                    <span className="text-sm font-semibold text-blue-600">
                      View results →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Active session and results */}
        {session && (
          <section className="mt-8 space-y-6">
            {/* Session information */}
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-green-900">Session details</h3>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    session.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {session.isActive ? "Active" : "Ended"}
                </span>
              </div>

              <p className="mt-3 text-sm text-green-800">
                Lesson: {session.topic}
              </p>

              <div className="mt-4 rounded-xl border border-green-200 bg-white p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Classroom session code
                </p>

                <p className="mt-2 text-4xl font-bold tracking-widest text-green-700">
                  {session.code}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Share this code with your students.
                </p>
              </div>

              {session.isActive && (
                <a
                  href="/join"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-green-800 underline"
                >
                  Open student page →
                </a>
              )}

              {endError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {endError}
                </p>
              )}

              {session.isActive && (
                <button
                  type="button"
                  onClick={handleEndSession}
                  disabled={ending}
                  className="mt-5 w-full rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {ending ? "Ending session..." : "End session"}
                </button>
              )}

              {!session.isActive && (
                <p className="mt-4 text-sm font-medium text-slate-600">
                  This session has ended. Your results are still available
                  below.
                </p>
              )}
            </div>

            {/* Understanding Checks */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Understanding Checks</h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Monitor understanding concept by concept.
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {pulses.length} Pulses
                </span>
              </div>

              {/* Existing Pulses */}
              <div className="mt-6 space-y-3">
                {/* Pulse action error */}
                {pulseActionError && (
                  <p role="alert" className="mb-4 text-sm text-red-600">
                    {pulseActionError}
                  </p>
                )}

                {pulsesLoading ? (
                  <p className="text-sm text-slate-500">Loading Pulses...</p>
                ) : pulses.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No understanding checks yet. Create your first Pulse below.
                  </p>
                ) : (
                  pulses.map((pulse) => (
                    <div
                      key={pulse.id}
                      className="rounded-xl border border-slate-200 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-slate-800">
                          {pulse.concept}
                        </h4>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            pulse.isActive
                              ? pulse.isPaused
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {pulse.isActive
                            ? pulse.isPaused
                              ? "Paused"
                              : "Active"
                            : "Completed"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {pulse.question}
                      </p>

                      {/* Statistics */}
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-blue-50 p-4">
                          <p className="text-xs font-medium text-blue-700">
                            Responses
                          </p>
                          <p className="mt-1 text-2xl font-bold text-blue-900">
                            {pulse.totalResponses}
                          </p>
                        </div>

                        <div className="rounded-xl bg-purple-50 p-4">
                          <p className="text-xs font-medium text-purple-700">
                            Average understanding
                          </p>
                          <p className="mt-1 text-2xl font-bold text-purple-900">
                            {pulse.totalResponses > 0
                              ? `${pulse.averageScore}/5`
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Score distribution */}
                      <div className="mt-5">
                        <h5 className="text-sm font-semibold text-slate-700">
                          Understanding distribution
                        </h5>

                        <div className="mt-4 space-y-3">
                          {([1, 2, 3, 4, 5] as const).map((score) => {
                            const count =
                              pulse.distribution[
                                String(score) as keyof PulseDistribution
                              ];

                            const percentage =
                              pulse.totalResponses > 0
                                ? (count / pulse.totalResponses) * 100
                                : 0;

                            return (
                              <div key={score}>
                                <div className="mb-1 flex justify-between text-xs">
                                  <span className="text-slate-600">
                                    Score {score}
                                  </span>

                                  <span className="font-medium text-slate-700">
                                    {count} students ({Math.round(percentage)}%)
                                  </span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* END PULSE BUTTON */}
                      {pulse.isActive && (
                        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row">
                          {/* Pause / Resume button */}
                          <button
                            type="button"
                            onClick={() =>
                              handlePauseResumePulse(
                                pulse.id,
                                pulse.isPaused ? "resume" : "pause",
                              )
                            }
                            disabled={
                              updatingPulseId === pulse.id ||
                              endingPulseId === pulse.id
                            }
                            className="flex-1 rounded-xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                          >
                            {updatingPulseId === pulse.id
                              ? pulse.isPaused
                                ? "Resuming..."
                                : "Pausing..."
                              : pulse.isPaused
                                ? "Resume Pulse"
                                : "Pause Pulse"}
                          </button>

                          {/* End button */}
                          <button
                            type="button"
                            onClick={() => handleEndPulse(pulse.id)}
                            disabled={
                              endingPulseId === pulse.id ||
                              updatingPulseId === pulse.id
                            }
                            className="flex-1 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {endingPulseId === pulse.id
                              ? "Ending Pulse..."
                              : "End this Pulse"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Create Pulse form */}
              {session.isActive && (
                <div className="mt-7 border-t border-slate-200 pt-6">
                  <h4 className="font-bold">Create a new Pulse</h4>

                  <p className="mt-1 text-sm text-slate-500">
                    Choose a concept and ask your students about their
                    understanding.
                  </p>

                  <form onSubmit={handleCreatePulse} className="mt-5 space-y-4">
                    <div>
                      <label
                        htmlFor="concept"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Concept
                      </label>

                      <input
                        id="concept"
                        type="text"
                        value={concept}
                        onChange={(event) => setConcept(event.target.value)}
                        maxLength={100}
                        placeholder="e.g. Functions"
                        required
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="question"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Understanding question
                      </label>

                      <textarea
                        id="question"
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        maxLength={300}
                        rows={3}
                        placeholder="How well do you understand JavaScript functions?"
                        required
                        className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {pulsesError && (
                      <p role="alert" className="text-sm text-red-600">
                        {pulsesError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={
                        creatingPulse || !concept.trim() || !question.trim()
                      }
                      className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingPulse ? "Creating Pulse..." : "+ Create Pulse"}
                    </button>
                  </form>
                </div>
              )}

              {!session.isActive && (
                <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  This classroom has ended. You can still review its previous
                  Pulses.
                </p>
              )}
            </div>

            {/* Results dashboard */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">Student understanding</h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Live results for {session.topic}
                  </p>
                </div>

                <span className="flex items-center gap-2 text-xs font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Refreshing every 3 seconds
                </span>
              </div>

              {resultsError && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {resultsError}
                </p>
              )}

              {results ? (
                <>
                  {/* Summary cards */}
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-blue-50 p-5">
                      <p className="text-sm font-medium text-blue-700">
                        Total responses
                      </p>

                      <p className="mt-2 text-3xl font-bold text-blue-900">
                        {results.totalResponses}
                      </p>
                    </div>

                    <div className="rounded-xl bg-purple-50 p-5">
                      <p className="text-sm font-medium text-purple-700">
                        Average understanding
                      </p>

                      <p className="mt-2 text-3xl font-bold text-purple-900">
                        {results.averageScore} / 5
                      </p>
                    </div>
                  </div>

                  {/* Distribution */}
                  <div className="mt-8">
                    <h4 className="font-bold">Understanding distribution</h4>

                    <p className="mt-1 text-sm text-slate-500">
                      Number of students who selected each score.
                    </p>

                    <div className="mt-6 space-y-5">
                      {([1, 2, 3, 4, 5] as const).map((score) => {
                        const count =
                          results.distribution[
                            String(score) as keyof Distribution
                          ];

                        const percentage =
                          results.totalResponses > 0
                            ? (count / results.totalResponses) * 100
                            : 0;

                        return (
                          <div key={score}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">
                                Score {score}
                              </span>

                              <span className="text-slate-500">
                                {count} students ({Math.round(percentage)}%)
                              </span>
                            </div>

                            <div
                              className="h-3 overflow-hidden rounded-full bg-slate-100"
                              role="progressbar"
                              aria-label={`Score ${score} responses`}
                              aria-valuenow={percentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="font-semibold text-slate-700">
                    Loading results...
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Waiting for student responses.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {!session && (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Create a session",
                description:
                  "Enter a lesson topic and generate a classroom code.",
              },
              {
                title: "Students respond",
                description: "Students join and rate their understanding.",
              },
              {
                title: "Review results",
                description: "Discover which concepts need more explanation.",
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="text-sm font-bold text-blue-600">
                  0{index + 1}
                </span>

                <h3 className="mt-3 font-bold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
