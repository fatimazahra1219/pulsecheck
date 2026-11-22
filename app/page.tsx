"use client";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

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

type KnowledgeCheckStats = {
  totalResponses: number;
  correctResponses: number;
  accuracyPercentage: number;
  averageConfidence: number;
  confidentCorrect: number;
  unsureCorrect: number;
  unsureIncorrect: number;
  confidentIncorrect: number;
};

type AnswerDistribution = {
  id: string;
  text: string;
  isCorrect: boolean;
  count: number;
  percentage: number;
  averageConfidence: number | null;
  confidentIncorrectCount: number;
};
type Pulse = {
  id: string;
  concept: string;
  question: string;
  mode?: "rating" | "knowledge_check";
  answerOptions?: Array<{
    id: string;
    text: string;
  }>;

  correctOptionId?: string;
  explanation?: string;
  knowledgeCheckStats?: KnowledgeCheckStats | null;
  answerDistribution?: AnswerDistribution[] | null;
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
  // Pulse form
  const [concept, setConcept] = useState("");
  const [question, setQuestion] = useState("");

  const [pulseMode, setPulseMode] = useState<"rating" | "knowledge_check">(
    "rating",
  );

  const [answerOptions, setAnswerOptions] = useState([
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ]);

  const [correctOptionId, setCorrectOptionId] = useState("A");
  const [explanation, setExplanation] = useState("");

  // Existing Pulses
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [pulsesLoading, setPulsesLoading] = useState(true);
  const [showCompletedPulses, setShowCompletedPulses] = useState<
    boolean | null
  >(null);

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
      localStorage.setItem("pulsecheck-selected-session", data.session.code);
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

  function handleBackToOverview() {
    // Forget the selected classroom.
    localStorage.removeItem("pulsecheck-selected-session");

    // Return to the dashboard overview.
    setSession(null);

    // Clear classroom-specific information.
    setResults(null);
    setResultsError("");
    setPulses([]);
    setPulsesLoading(true);
    setPulsesError("");
    setPulseActionError("");
    setEndError("");

    // Reset the Pulse creation form.
    setConcept("");
    setQuestion("");
    setPulseMode("rating");
    setAnswerOptions([
      { id: "A", text: "" },
      { id: "B", text: "" },
      { id: "C", text: "" },
      { id: "D", text: "" },
    ]);
    setCorrectOptionId("A");
    setExplanation("");
  }

  //sending the teacher's information to the backend.

  async function handleCreatePulse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !session.isActive) return;

    setPulsesError("");

    // Keep only options that contain text.
    const preparedAnswerOptions = answerOptions
      .filter((option) => option.text.trim().length > 0)
      .map((option) => ({
        id: option.id,
        text: option.text.trim(),
      }));

    // Validate the knowledge-check configuration.
    if (pulseMode === "knowledge_check") {
      if (preparedAnswerOptions.length < 2) {
        setPulsesError("Please provide at least two answer options.");
        return;
      }

      if (
        !preparedAnswerOptions.some((option) => option.id === correctOptionId)
      ) {
        setPulsesError("Please select one of your filled options as correct.");
        return;
      }
      if (!explanation.trim()) {
        setPulsesError("Please provide an explanation for the correct answer.");
        return;
      }

      if (explanation.trim().length > 1000) {
        setPulsesError("The explanation cannot exceed 1000 characters.");
        return;
      }
    }

    setCreatingPulse(true);

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
            mode: pulseMode,
            ...(pulseMode === "knowledge_check"
              ? {
                  answerOptions: preparedAnswerOptions,
                  correctOptionId,
                  explanation: explanation.trim(),
                }
              : {}),
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

      // Reset the form after successful creation.
      setConcept("");
      setQuestion("");
      setPulseMode("rating");
      setExplanation("");
      setAnswerOptions([
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ]);
      setCorrectOptionId("A");

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
          const loadedSessions = data.sessions ?? [];

          setSessions(loadedSessions);

          // Restore the previously selected classroom.
          const savedCode = localStorage.getItem("pulsecheck-selected-session");

          const savedSession = loadedSessions.find(
            (item) => item.code === savedCode,
          );

          if (savedSession) {
            setSession(
              (current) =>
                current ?? {
                  code: savedSession.code,
                  topic: savedSession.topic,
                  isActive: savedSession.isActive,
                },
            );
          } else if (savedCode) {
            // The saved classroom is no longer available in teacher history.
            localStorage.removeItem("pulsecheck-selected-session");
          }
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

  // Find Pulses with responses and an average below 3/5.
  const attentionPulses = pulses.filter(
    (pulse) =>
      pulse.mode === "rating" &&
      pulse.totalResponses > 0 &&
      pulse.averageScore < 3,
  );

  // Find concepts where student understanding is divided.
  const mixedUnderstandingPulses = pulses.filter((pulse) => {
    if (pulse.mode !== "rating") return false;
    // Require a minimum number of responses.
    if (pulse.totalResponses < 5) return false;
    // The existing low-average alert handles these cases.
    if (pulse.averageScore < 3) return false;

    const lowResponses = pulse.distribution["1"] + pulse.distribution["2"];

    const highResponses = pulse.distribution["4"] + pulse.distribution["5"];

    const lowPercentage = lowResponses / pulse.totalResponses;
    const highPercentage = highResponses / pulse.totalResponses;

    return lowPercentage >= 0.25 && highPercentage >= 0.25;
  });

  // Always show active or paused Pulses before completed ones.
  const sortedPulses = [...pulses].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activePulseCount = pulses.filter((pulse) => pulse.isActive).length;

  const completedPulseCount = pulses.length - activePulseCount;

  // In ended classrooms, show completed Pulses by default.
  const completedPulsesExpanded = showCompletedPulses ?? activePulseCount === 0;

  return (
    <main className="min-h-screen bg-[#f6f6fb] text-slate-900 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25">
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
          </Link>

          <Link
            href="/join"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Preview student view ↗
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------- Sidebar ---------- */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {/* Create classroom */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="text-base font-bold">New classroom</h2>
            <p className="mt-1 text-sm text-slate-500">
              Name your lesson and get a code for your students.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <label htmlFor="topic" className="sr-only">
                Lesson topic
              </label>
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. JavaScript array methods"
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !topic.trim()}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create classroom"}
              </button>
            </form>
          </section>

          {/* Classroom list */}
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">My classrooms</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {sessions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryRefresh((current) => current + 1)}
                disabled={historyLoading}
                aria-label="Refresh classrooms"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className={historyLoading ? "animate-spin" : ""}
                >
                  ↻
                </span>
              </button>
            </div>

            {historyError && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {historyError}
              </p>
            )}

            {historyLoading && sessions.length === 0 ? (
              <div className="mt-4 space-y-2" aria-hidden="true">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
                <p className="text-2xl" aria-hidden="true">
                  🎒
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No classrooms yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first one above to get started.
                </p>
              </div>
            ) : (
              <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {sessions.map((item) => {
                  const selected = sessionCode === item.code;

                  return (
                    <li key={item.code}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          localStorage.setItem(
                            "pulsecheck-selected-session",
                            item.code,
                          );

                          setSession({
                            code: item.code,
                            topic: item.topic,
                            isActive: item.isActive,
                          });

                          setPulses([]);
                          setPulsesLoading(true);
                          setResults(null);
                          setShowCompletedPulses(null);
                        }}
                        className={`group w-full rounded-xl p-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                          selected
                            ? "bg-indigo-50 ring-2 ring-indigo-500"
                            : "ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-indigo-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-bold text-slate-900">
                            {item.topic}
                          </span>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
                              item.isActive
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.isActive
                                  ? "bg-emerald-500"
                                  : "bg-slate-300"
                              }`}
                            />
                            {item.isActive ? "Live" : "Ended"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono font-semibold tracking-widest text-slate-600">
                            {item.code}
                          </span>
                          <span>
                            {item.totalResponses}{" "}
                            {item.totalResponses === 1
                              ? "response"
                              : "responses"}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>

        {/* ---------- Main workspace ---------- */}
        <div className="min-w-0 space-y-6">
          {!session ? (
            /* Welcome state */
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-10">
              <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Know what your students understand, while you are still
                teaching.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
                Students can share their understanding without entering their
                names, making it easier to express when they need help. Pick a
                classroom on the left or create a new one to begin.
              </p>

              <ol className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "Create a classroom",
                    description:
                      "Enter your lesson topic and get a short join code.",
                    icon: "🏫",
                  },
                  {
                    title: "Ask a Pulse",
                    description:
                      "Pick a concept and ask students to rate it from 1 to 5.",
                    icon: "💬",
                  },
                  {
                    title: "Adapt on the spot",
                    description:
                      "Watch the results update live and slow down where needed.",
                    icon: "📈",
                  },
                ].map((item, index) => (
                  <li
                    key={item.title}
                    className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      <span className="text-sm font-semibold text-indigo-600">
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBackToOverview}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span aria-hidden="true">←</span>
                All classrooms
              </button>
              {/* Classroom overview with the join code */}
              <section className="overflow-hidden rounded-3xl bg-indigo-950 text-white shadow-xl shadow-indigo-950/10">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          session.isActive
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-white/10 text-indigo-200"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            session.isActive
                              ? "animate-pulse bg-emerald-400"
                              : "bg-indigo-300"
                          }`}
                        />
                        {session.isActive ? "Classroom active" : "Ended"}
                      </span>
                      <h2 className="mt-3 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
                        {session.topic}
                      </h2>
                    </div>

                    {session.isActive && (
                      <button
                        type="button"
                        onClick={handleEndSession}
                        disabled={ending}
                        className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:border-rose-300/60 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                      >
                        {ending ? "Ending..." : "End classroom"}
                      </button>
                    )}
                  </div>

                  {/* The join code */}
                  <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-200">
                        Students join with this code
                      </p>
                      <div
                        className="mt-3 flex flex-wrap gap-2 sm:gap-3"
                        aria-label={`Join code ${session.code}`}
                      >
                        {session.code.split("").map((char, index) => (
                          <span
                            key={`${char}-${index}`}
                            className="flex h-14 w-11 items-center justify-center rounded-lg bg-white font-mono text-3xl font-extrabold text-indigo-950 shadow-lg shadow-black/20 sm:h-20 sm:w-16 sm:text-5xl"
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>

                    {session.isActive && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            const button = event.currentTarget;
                            void navigator.clipboard
                              .writeText(session.code)
                              .then(() => {
                                button.dataset.copied = "true";
                                window.setTimeout(() => {
                                  delete button.dataset.copied;
                                }, 1800);
                              });
                          }}
                          className="group rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          <span className="group-data-[copied=true]:hidden">
                            Copy code
                          </span>
                          <span className="hidden text-emerald-300 group-data-[copied=true]:inline">
                            Copied ✓
                          </span>
                        </button>
                        <Link
                          href="/join"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-950 transition hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                          Open student page ↗
                        </Link>
                      </div>
                    )}
                  </div>

                  {endError && (
                    <p
                      role="alert"
                      className="mt-5 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200"
                    >
                      {endError}
                    </p>
                  )}

                  {!session.isActive && (
                    <p className="mt-6 text-sm text-indigo-200">
                      This classroom has ended. You can still review its Pulses
                      and results below.
                    </p>
                  )}
                </div>
              </section>

              {/* Overall results */}
              <section
                aria-labelledby="results-heading"
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="results-heading"
                      className="text-xl font-extrabold tracking-tight"
                    >
                      How the class is doing
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Combined understanding feedback from Quick Rating Pulses.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Updates every 3 seconds
                  </span>
                </div>

                {resultsError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {resultsError}
                  </p>
                )}

                {results ? (
                  <div className="mt-6 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="text-sm font-medium text-slate-500">
                          Responses
                        </p>
                        <p className="mt-1 text-4xl font-extrabold tracking-tight">
                          {results.totalResponses}
                        </p>
                      </div>

                      <div
                        className={`rounded-xl p-4 ${
                          results.totalResponses < 5
                            ? "bg-slate-50"
                            : results.averageScore < 3
                              ? "bg-amber-50"
                              : "bg-emerald-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-500">
                          Average reported understanding{" "}
                        </p>
                        <p className="mt-1 text-4xl font-extrabold tracking-tight">
                          {results.totalResponses > 0 ? (
                            <>
                              {results.averageScore}
                              <span className="text-lg font-bold text-slate-400">
                                {" "}
                                / 5
                              </span>
                            </>
                          ) : (
                            "—"
                          )}
                        </p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            results.totalResponses === 0
                              ? "Waiting for the first response"
                              : results.totalResponses < 5
                                ? `Early signal — based on ${results.totalResponses} responses`
                                : results.averageScore < 3
                                  ? "Consider explaining again"
                                  : "The class average is looking positive"
                          }`}
                        >
                          {results.totalResponses === 0
                            ? "Waiting for the first response"
                            : results.totalResponses < 5
                              ? `Early signal — based on ${results.totalResponses} Quick Rating responses`
                              : results.averageScore < 3
                                ? "Students are reporting difficulty. Consider revisiting the concepts."
                                : "Students are reporting positive understanding. Verify with a Knowledge Check."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
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
                            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                              <span className="font-semibold text-slate-700">
                                {score}{" "}
                                <span className="font-medium text-slate-400">
                                  {
                                    [
                                      "Lost",
                                      "Unsure",
                                      "Getting there",
                                      "Good",
                                      "Got it",
                                    ][score - 1]
                                  }
                                </span>
                              </span>
                              <span className="text-xs text-slate-500">
                                {count} ({Math.round(percentage)}%)
                              </span>
                            </div>
                            <div
                              className="h-3 overflow-hidden rounded-full bg-slate-100"
                              role="progressbar"
                              aria-label={`Score ${score} responses`}
                              aria-valuenow={Math.round(percentage)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  [
                                    "bg-rose-500",
                                    "bg-orange-400",
                                    "bg-amber-400",
                                    "bg-lime-500",
                                    "bg-emerald-500",
                                  ][score - 1]
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-6 animate-pulse space-y-3"
                    aria-hidden="true"
                  >
                    <div className="h-24 rounded-xl bg-slate-100" />
                    <div className="h-24 rounded-xl bg-slate-100" />
                  </div>
                )}
              </section>

              {/* Pulses */}
              <section
                aria-labelledby="pulses-heading"
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="pulses-heading"
                      className="text-xl font-extrabold tracking-tight"
                    >
                      Understanding checks
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Ask about one concept at a time and watch the answers
                      arrive.
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                    {pulses.length} {pulses.length === 1 ? "Pulse" : "Pulses"}
                  </span>
                </div>

                {/* Smart understanding alerts */}
                {!pulsesLoading && attentionPulses.length > 0 && (
                  <div
                    role="status"
                    className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg font-bold text-amber-800"
                        aria-hidden="true"
                      >
                        !
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-amber-950">
                            {attentionPulses.length}{" "}
                            {attentionPulses.length === 1
                              ? "Pulse needs"
                              : "Pulses need"}{" "}
                            attention
                          </h3>

                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Below 3/5
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-amber-800">
                          These Quick Rating results show low average
                          understanding. Treat results with fewer than five
                          responses as early signals and gather more feedback
                          before deciding what to revisit.
                        </p>

                        <ul className="mt-4 space-y-2">
                          {attentionPulses.map((pulse) => (
                            <li
                              key={pulse.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-3"
                            >
                              <span className="text-sm font-semibold text-slate-800">
                                {pulse.concept}
                              </span>

                              <span className="text-sm font-bold text-amber-800">
                                {pulse.averageScore}/5
                                <span className="ml-1 text-xs font-normal text-slate-500">
                                  ({pulse.totalResponses}{" "}
                                  {pulse.totalResponses === 1
                                    ? "response"
                                    : "responses"}
                                  )
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mixed understanding alerts */}
                {!pulsesLoading && mixedUnderstandingPulses.length > 0 && (
                  <div
                    role="status"
                    className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-lg font-bold text-indigo-700"
                        aria-hidden="true"
                      >
                        ↔
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-indigo-950">
                            Mixed understanding detected
                          </h3>

                          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                            {mixedUnderstandingPulses.length}{" "}
                            {mixedUnderstandingPulses.length === 1
                              ? "concept"
                              : "concepts"}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-indigo-800">
                          Students have noticeably different levels of
                          understanding. Some may need additional support while
                          others are ready to move forward.
                        </p>

                        <ul className="mt-4 space-y-2">
                          {mixedUnderstandingPulses.map((pulse) => {
                            const lowResponses =
                              pulse.distribution["1"] + pulse.distribution["2"];

                            const highResponses =
                              pulse.distribution["4"] + pulse.distribution["5"];

                            const lowPercentage = Math.round(
                              (lowResponses / pulse.totalResponses) * 100,
                            );

                            const highPercentage = Math.round(
                              (highResponses / pulse.totalResponses) * 100,
                            );

                            return (
                              <li
                                key={pulse.id}
                                className="rounded-xl bg-white/80 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-slate-800">
                                    {pulse.concept}
                                  </span>

                                  <span className="text-sm font-bold text-indigo-800">
                                    {pulse.averageScore}/5
                                  </span>
                                </div>

                                <p className="mt-2 text-xs leading-5 text-slate-600">
                                  {lowResponses} students struggling (
                                  {lowPercentage}%)
                                  {" · "}
                                  {highResponses} students confident (
                                  {highPercentage}%)
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  Based on {pulse.totalResponses} responses
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Pulse */}
                {session.isActive && (
                  <form
                    onSubmit={handleCreatePulse}
                    className="mt-6 rounded-2xl bg-indigo-50/70 p-5 ring-1 ring-indigo-100"
                  >
                    <h3 className="font-bold text-slate-900">
                      Ask a new Pulse
                    </h3>

                    <div className="mt-4">
                      <label
                        htmlFor="pulseMode"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Choose Pulse type
                      </label>

                      <select
                        id="pulseMode"
                        value={pulseMode}
                        onChange={(event) =>
                          setPulseMode(
                            event.target.value as "rating" | "knowledge_check",
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="rating">
                          Quick understanding — confidence rating (1–5)
                        </option>
                        <option value="knowledge_check">
                          Confidence + Knowledge Check
                        </option>
                      </select>

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {pulseMode === "rating"
                          ? "Students rate how well they understand the concept."
                          : "Students rate their confidence and answer a multiple-choice question."}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.6fr]">
                      <div>
                        <label
                          htmlFor="concept"
                          className="mb-1.5 block text-sm font-semibold text-slate-700"
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
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="question"
                          className="mb-1.5 block text-sm font-semibold text-slate-700"
                        >
                          {pulseMode === "knowledge_check"
                            ? "Multiple-choice question"
                            : "Question for students"}
                        </label>

                        <input
                          id="question"
                          type="text"
                          value={question}
                          onChange={(event) => setQuestion(event.target.value)}
                          maxLength={300}
                          placeholder={
                            pulseMode === "knowledge_check"
                              ? "e.g. Which array method returns a new filtered array?"
                              : "How well do you understand this concept?"
                          }
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        />
                      </div>
                    </div>

                    {pulseMode === "knowledge_check" && (
                      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-indigo-100">
                        <h4 className="font-bold text-slate-900">
                          Answer options
                        </h4>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Fill in at least two options. Select the radio button
                          beside the correct answer.
                        </p>

                        <div className="mt-4 space-y-3">
                          {answerOptions.map((option, index) => (
                            <div
                              key={option.id}
                              className="rounded-xl border border-slate-200 p-3"
                            >
                              <label
                                htmlFor={`answer-option-${option.id}`}
                                className="mb-2 block text-sm font-semibold text-slate-700"
                              >
                                Option {option.id}
                                {index < 2 && (
                                  <span className="ml-1 text-rose-600">*</span>
                                )}
                              </label>

                              <input
                                id={`answer-option-${option.id}`}
                                type="text"
                                value={option.text}
                                onChange={(event) =>
                                  setAnswerOptions((current) =>
                                    current.map((item) =>
                                      item.id === option.id
                                        ? { ...item, text: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder={`Enter answer ${option.id}`}
                                maxLength={200}
                                required={index < 2}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                              />

                              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="radio"
                                  name="correctOptionId"
                                  value={option.id}
                                  checked={correctOptionId === option.id}
                                  disabled={!option.text.trim()}
                                  onChange={() => setCorrectOptionId(option.id)}
                                  className="h-4 w-4 accent-indigo-600"
                                />
                                This is the correct answer
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pulseMode === "knowledge_check" && (
                      <div className="mt-4">
                        <label
                          htmlFor="explanation"
                          className="mb-1.5 block text-sm font-semibold text-slate-700"
                        >
                          Explanation of the correct answer
                        </label>

                        <textarea
                          id="explanation"
                          value={explanation}
                          onChange={(event) =>
                            setExplanation(event.target.value)
                          }
                          placeholder="Explain why this answer is correct and help students understand the concept..."
                          maxLength={1000}
                          rows={4}
                          required
                          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        />

                        <p className="mt-1 text-right text-xs text-slate-400">
                          {explanation.length}/1000 characters
                        </p>
                      </div>
                    )}

                    {pulseMode === "rating" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">
                          Quick questions:
                        </span>
                        {[
                          "How well do you understand this concept?",
                          "Could you explain this to a classmate?",
                          "How confident are you using this on your own?",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setQuestion(suggestion)}
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-indigo-700 hover:ring-indigo-300"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {pulsesError && (
                      <p
                        role="alert"
                        className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                      >
                        {pulsesError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={
                        creatingPulse || !concept.trim() || !question.trim()
                      }
                      className="mt-5 w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {creatingPulse
                        ? "Creating..."
                        : pulseMode === "knowledge_check"
                          ? "Create Knowledge Check"
                          : "Send Pulse"}
                    </button>
                  </form>
                )}

                {pulseActionError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {pulseActionError}
                  </p>
                )}

                {/* Pulse list */}
                <div className="mt-6 space-y-4">
                  {pulsesLoading ? (
                    <div className="animate-pulse space-y-3" aria-hidden="true">
                      <div className="h-40 rounded-2xl bg-slate-100" />
                      <div className="h-40 rounded-2xl bg-slate-100" />
                    </div>
                  ) : pulses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center">
                      <p className="text-3xl" aria-hidden="true">
                        💡
                      </p>
                      <p className="mt-3 font-bold text-slate-800">
                        No Pulses yet
                      </p>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        {session.isActive
                          ? "Ask your first question above and students will see it right away."
                          : "No Pulses were created in this classroom."}
                      </p>
                    </div>
                  ) : (
                    sortedPulses.map((pulse, index) => (
                      <Fragment key={pulse.id}>
                        {/* Completed Pulse toggle, shown after active Pulses */}
                        {index === activePulseCount &&
                          completedPulseCount > 0 && (
                            <button
                              type="button"
                              aria-expanded={completedPulsesExpanded}
                              onClick={() =>
                                setShowCompletedPulses(!completedPulsesExpanded)
                              }
                              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              <span>
                                {completedPulsesExpanded ? "Hide" : "Show"}{" "}
                                completed Pulses ({completedPulseCount})
                              </span>

                              <span aria-hidden="true">
                                {completedPulsesExpanded ? "⌃" : "⌄"}
                              </span>
                            </button>
                          )}

                        {(pulse.isActive || completedPulsesExpanded) && (
                          <article
                            className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6 ${
                              pulse.isActive
                                ? pulse.isPaused
                                  ? "border-l-amber-400"
                                  : "border-l-emerald-500"
                                : "border-l-slate-300"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words text-lg font-bold text-slate-900">
                                  {pulse.concept}
                                </h3>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                  {pulse.question}
                                </p>

                                {/* Teacher-only question details and answer key */}
                                {pulse.mode === "knowledge_check" && (
                                  <details className="mt-4 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/40">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-bold text-indigo-900 hover:bg-indigo-50">
                                      <span>Question details & answer key</span>
                                      <span aria-hidden="true">⌄</span>
                                    </summary>

                                    <div className="border-t border-indigo-100 p-4">
                                      <h4 className="text-sm font-bold text-slate-800">
                                        Answer options
                                      </h4>

                                      <div className="mt-3 space-y-2">
                                        {(pulse.answerOptions ?? []).map(
                                          (option, index) => {
                                            const isCorrect =
                                              option.id ===
                                              pulse.correctOptionId;

                                            return (
                                              <div
                                                key={option.id}
                                                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                                                  isCorrect
                                                    ? "border-emerald-200 bg-emerald-50"
                                                    : "border-slate-200 bg-white"
                                                }`}
                                              >
                                                <div className="flex min-w-0 items-center gap-3">
                                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                                                    {String.fromCharCode(
                                                      65 + index,
                                                    )}
                                                  </span>

                                                  <span className="text-sm font-medium text-slate-800">
                                                    {option.text}
                                                  </span>
                                                </div>

                                                {isCorrect && (
                                                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                                    Correct ✓
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>

                                      <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
                                        <h4 className="text-sm font-bold text-slate-800">
                                          Explanation
                                        </h4>

                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                          {pulse.explanation ||
                                            "No explanation provided."}
                                        </p>
                                      </div>
                                    </div>
                                  </details>
                                )}

                                {pulse.totalResponses > 0 &&
                                  pulse.averageScore < 3 && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                                      <span
                                        className="text-amber-700"
                                        aria-hidden="true"
                                      >
                                        ⚠
                                      </span>

                                      <div>
                                        <p className="text-xs font-bold text-amber-900">
                                          Needs attention
                                        </p>

                                        <p className="mt-0.5 text-xs leading-5 text-amber-800">
                                          Average understanding is below 3/5.
                                          Consider explaining this concept
                                          again.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                              </div>

                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                  pulse.isActive
                                    ? pulse.isPaused
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    pulse.isActive
                                      ? pulse.isPaused
                                        ? "bg-amber-500"
                                        : "animate-pulse bg-emerald-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                                {pulse.isActive
                                  ? pulse.isPaused
                                    ? "Paused"
                                    : "Collecting answers"
                                  : "Completed"}
                              </span>
                            </div>

                            <div className="mt-5 grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
                              <div className="flex gap-3 md:flex-col">
                                <div className="flex-1 rounded-xl bg-slate-50 p-3.5">
                                  <p className="text-xs font-medium text-slate-500">
                                    Responses
                                  </p>
                                  <p className="mt-1 text-2xl font-extrabold">
                                    {pulse.totalResponses}
                                  </p>
                                </div>
                                <div
                                  className={`flex-1 rounded-xl p-3.5 ${
                                    pulse.totalResponses === 0
                                      ? "bg-slate-50"
                                      : pulse.averageScore < 3
                                        ? "bg-amber-50"
                                        : "bg-emerald-50"
                                  }`}
                                >
                                  <p className="text-xs font-medium text-slate-500">
                                    {pulse.mode === "knowledge_check"
                                      ? "Avg confidence"
                                      : "Average"}
                                  </p>
                                  <p className="mt-1 text-2xl font-extrabold">
                                    {pulse.totalResponses > 0
                                      ? pulse.mode === "knowledge_check"
                                        ? `${pulse.knowledgeCheckStats?.averageConfidence ?? pulse.averageScore} / 5`
                                        : `${pulse.averageScore} / 5`
                                      : "—"}
                                  </p>
                                  {pulse.mode === "knowledge_check" &&
                                    pulse.knowledgeCheckStats &&
                                    pulse.knowledgeCheckStats.totalResponses >
                                      0 && (
                                      <p className="mt-2 border-t border-slate-200 pt-2 text-xs font-bold text-indigo-700">
                                        {
                                          pulse.knowledgeCheckStats
                                            .accuracyPercentage
                                        }
                                        % correct
                                        {" · "}
                                        {
                                          pulse.knowledgeCheckStats
                                            .correctResponses
                                        }
                                        /
                                        {
                                          pulse.knowledgeCheckStats
                                            .totalResponses
                                        }{" "}
                                        students
                                      </p>
                                    )}
                                </div>
                              </div>

                              <div className="space-y-2.5">
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
                                    <div
                                      key={score}
                                      className="flex items-center gap-3"
                                    >
                                      <span className="w-4 text-sm font-bold text-slate-600">
                                        {score}
                                      </span>
                                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                          className={`h-full rounded-full transition-all duration-700 ${
                                            [
                                              "bg-rose-500",
                                              "bg-orange-400",
                                              "bg-amber-400",
                                              "bg-lime-500",
                                              "bg-emerald-500",
                                            ][score - 1]
                                          }`}
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      <span className="w-20 text-right text-xs text-slate-500">
                                        {count} ({Math.round(percentage)}%)
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Knowledge Check confidence analytics */}

                            {/* Knowledge Check confidence matrix */}
                            {pulse.mode === "knowledge_check" &&
                              pulse.knowledgeCheckStats && (
                                <div className="mt-6 border-t border-slate-100 pt-5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="font-bold text-slate-900">
                                      Confidence vs. correctness
                                    </h4>

                                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                      {pulse.knowledgeCheckStats
                                        .totalResponses < 5
                                        ? `Early signal · ${pulse.knowledgeCheckStats.totalResponses} responses`
                                        : `${pulse.knowledgeCheckStats.totalResponses} responses analyzed`}
                                    </span>
                                  </div>

                                  <details className="mt-3">
                                    <summary className="w-fit cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                      How are these groups defined?
                                    </summary>

                                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                                      Unsure means confidence scores 1–3.
                                      Confident means scores 4–5. Correctness is
                                      determined by comparing the student&apos;s
                                      answer with the teacher&apos;s correct
                                      answer.
                                    </p>
                                  </details>

                                  {pulse.knowledgeCheckStats.totalResponses <
                                    5 && (
                                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                                      Early signal: these patterns are based on
                                      a small number of responses and may change
                                      as more students participate.
                                    </p>
                                  )}

                                  {pulse.knowledgeCheckStats.totalResponses ===
                                  0 ? (
                                    <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                                      Waiting for students to submit their
                                      answers.
                                    </p>
                                  ) : (
                                    <div className="mt-5">
                                      {/* Fixed column headings */}
                                      <div className="grid grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:gap-3">
                                        <div />

                                        <div className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-bold text-slate-600">
                                          Unsure
                                          <span className="mt-1 block text-[10px] font-normal">
                                            1–3
                                          </span>
                                        </div>

                                        <div className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-bold text-slate-600">
                                          Confident
                                          <span className="mt-1 block text-[10px] font-normal">
                                            4–5
                                          </span>
                                        </div>

                                        {/* Correct row */}
                                        <div className="flex items-center justify-center rounded-lg bg-emerald-50 px-1 py-2 text-center text-xs font-bold text-emerald-800">
                                          Correct
                                        </div>

                                        <div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
                                          <p className="text-xs font-bold leading-5 text-blue-800">
                                            Underconfident
                                          </p>

                                          <p className="mt-3 text-3xl font-extrabold text-slate-900">
                                            {
                                              pulse.knowledgeCheckStats
                                                .unsureCorrect
                                            }
                                          </p>

                                          <p className="text-xs text-slate-500">
                                            {Math.round(
                                              (pulse.knowledgeCheckStats
                                                .unsureCorrect /
                                                pulse.knowledgeCheckStats
                                                  .totalResponses) *
                                                100,
                                            )}
                                            % of responses
                                          </p>
                                        </div>

                                        <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                                          <p className="text-xs font-bold leading-5 text-emerald-800">
                                            Well-calibrated
                                          </p>

                                          <p className="mt-3 text-3xl font-extrabold text-slate-900">
                                            {
                                              pulse.knowledgeCheckStats
                                                .confidentCorrect
                                            }
                                          </p>

                                          <p className="text-xs text-slate-500">
                                            {Math.round(
                                              (pulse.knowledgeCheckStats
                                                .confidentCorrect /
                                                pulse.knowledgeCheckStats
                                                  .totalResponses) *
                                                100,
                                            )}
                                            % of responses
                                          </p>
                                        </div>

                                        {/* Incorrect row */}
                                        <div className="flex items-center justify-center rounded-lg bg-rose-50 px-1 py-2 text-center text-xs font-bold text-rose-800">
                                          Incorrect
                                        </div>

                                        <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
                                          <p className="text-xs font-bold leading-5 text-amber-800">
                                            Knowledge gap
                                          </p>

                                          <p className="mt-3 text-3xl font-extrabold text-slate-900">
                                            {
                                              pulse.knowledgeCheckStats
                                                .unsureIncorrect
                                            }
                                          </p>

                                          <p className="text-xs text-slate-500">
                                            {Math.round(
                                              (pulse.knowledgeCheckStats
                                                .unsureIncorrect /
                                                pulse.knowledgeCheckStats
                                                  .totalResponses) *
                                                100,
                                            )}
                                            % of responses
                                          </p>
                                        </div>

                                        {/* Highlighted misconception cell */}
                                        <div className="min-w-0 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 shadow-sm sm:p-4">
                                          <p className="text-xs font-extrabold leading-5 text-rose-800">
                                            Possible misconception
                                          </p>

                                          <p className="mt-3 text-4xl font-extrabold text-rose-700">
                                            {
                                              pulse.knowledgeCheckStats
                                                .confidentIncorrect
                                            }
                                          </p>

                                          <p className="text-xs font-semibold text-rose-700">
                                            {Math.round(
                                              (pulse.knowledgeCheckStats
                                                .confidentIncorrect /
                                                pulse.knowledgeCheckStats
                                                  .totalResponses) *
                                                100,
                                            )}
                                            % of responses
                                          </p>

                                          <div className="mt-3 border-t border-rose-200 pt-3">
                                            <p className="text-xs font-bold text-rose-800">
                                              Confident incorrect choices:
                                            </p>

                                            {(pulse.answerDistribution ?? [])
                                              .filter(
                                                (option) =>
                                                  !option.isCorrect &&
                                                  option.confidentIncorrectCount >
                                                    0,
                                              )
                                              .map((option) => (
                                                <div
                                                  key={option.id}
                                                  className="mt-2 rounded-lg bg-white/80 p-3"
                                                >
                                                  <p className="text-sm font-bold text-slate-900">
                                                    Option {option.id} —{" "}
                                                    {option.text}
                                                  </p>

                                                  <p className="mt-1 text-xs font-semibold text-rose-700">
                                                    {
                                                      option.confidentIncorrectCount
                                                    }{" "}
                                                    {option.confidentIncorrectCount ===
                                                    1
                                                      ? "student was"
                                                      : "students were"}{" "}
                                                    confident and incorrect
                                                  </p>
                                                </div>
                                              ))}

                                            {(
                                              pulse.answerDistribution ?? []
                                            ).every(
                                              (option) =>
                                                option.isCorrect ||
                                                option.confidentIncorrectCount ===
                                                  0,
                                            ) && (
                                              <p className="mt-2 text-xs text-slate-500">
                                                No specific wrong option has
                                                attracted confident incorrect
                                                answers.
                                              </p>
                                            )}
                                          </div>

                                          {pulse.knowledgeCheckStats
                                            .confidentIncorrect > 0 ? (
                                            <p className="mt-3 border-t border-rose-200 pt-3 text-xs font-semibold leading-5 text-rose-800">
                                              {pulse.knowledgeCheckStats
                                                .totalResponses < 5
                                                ? "Early signal: gather more responses before treating this as a class-wide misconception."
                                                : "Consider revisiting this concept before moving on."}
                                            </p>
                                          ) : (
                                            <p className="mt-3 border-t border-rose-200 pt-3 text-xs text-rose-700">
                                              No confident incorrect answers
                                              detected.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                            {/* Answer distribution per option */}
                            {pulse.mode === "knowledge_check" &&
                              pulse.answerDistribution && (
                                <div className="mt-6 border-t border-slate-100 pt-5">
                                  <h4 className="font-bold text-slate-900">
                                    Answer distribution
                                  </h4>

                                  <p className="mt-1 text-sm text-slate-500">
                                    See which answers students selected and how
                                    confident they were.
                                  </p>

                                  <div className="mt-4 space-y-4">
                                    {pulse.answerDistribution.map((option) => (
                                      <div
                                        key={option.id}
                                        className="rounded-xl bg-slate-50 p-4"
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                                                Option {option.id}
                                              </span>

                                              {option.isCorrect && (
                                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                                                  Correct answer ✓
                                                </span>
                                              )}

                                              {!option.isCorrect &&
                                                option.confidentIncorrectCount >
                                                  0 && (
                                                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                                                    {
                                                      option.confidentIncorrectCount
                                                    }{" "}
                                                    confidently incorrect
                                                  </span>
                                                )}
                                            </div>

                                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                                              {option.text}
                                            </p>
                                          </div>

                                          <div className="shrink-0 text-right">
                                            <p className="text-2xl font-extrabold text-slate-900">
                                              {option.count}
                                            </p>

                                            <p className="text-xs font-semibold text-slate-500">
                                              {option.percentage}%
                                            </p>
                                          </div>
                                        </div>

                                        <div
                                          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200"
                                          role="progressbar"
                                          aria-label={`Option ${option.id} selections`}
                                          aria-valuenow={option.percentage}
                                          aria-valuemin={0}
                                          aria-valuemax={100}
                                        >
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              option.isCorrect
                                                ? "bg-emerald-500"
                                                : "bg-indigo-500"
                                            }`}
                                            style={{
                                              width: `${option.percentage}%`,
                                            }}
                                          />
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-xs text-slate-500">
                                            {option.count}{" "}
                                            {option.count === 1
                                              ? "student"
                                              : "students"}{" "}
                                            selected
                                          </span>

                                          <span className="text-xs font-semibold text-slate-600">
                                            {option.averageConfidence !== null
                                              ? `Avg confidence: ${option.averageConfidence}/5`
                                              : "No responses yet"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {pulse.isActive && (
                              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
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
                                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {updatingPulseId === pulse.id
                                    ? pulse.isPaused
                                      ? "Resuming..."
                                      : "Pausing..."
                                    : pulse.isPaused
                                      ? "Resume"
                                      : "Pause"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEndPulse(pulse.id)}
                                  disabled={
                                    endingPulseId === pulse.id ||
                                    updatingPulseId === pulse.id
                                  }
                                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {endingPulseId === pulse.id
                                    ? "Ending..."
                                    : "End Pulse"}
                                </button>
                              </div>
                            )}
                          </article>
                        )}
                      </Fragment>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          <footer className="pb-4 pt-2 text-center text-xs text-slate-400">
            PulseCheck. Anonymous feedback, better lessons.
          </footer>
        </div>
      </div>
    </main>
  );
}
