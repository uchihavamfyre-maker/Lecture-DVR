"use client";

import { AlertTriangle, BrainCircuit, Radio, Timer, Zap } from "lucide-react";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { type FlashcardCategory, useLectureListener } from "@/hooks/useLectureListener";

const categoryStyles: Record<FlashcardCategory, string> = {
  DEADLINE: "border-red-500/80 bg-red-500/10 text-red-100",
  EXAM_HINT: "border-yellow-400/80 bg-yellow-400/10 text-yellow-50",
  FORMULA: "border-blue-400/80 bg-blue-400/10 text-blue-100",
  FACT: "border-sky-400/80 bg-sky-400/10 text-sky-100",
  CONCEPT: "border-cyan-400/80 bg-cyan-400/10 text-cyan-100",
  EXAMPLE: "border-purple-400/80 bg-purple-400/10 text-purple-100",
};

function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");

  return `${hrs}:${mins}:${secs}`;
}

function normalizePanicSummary(summary: string): string {
  return summary.replace(/^\*\*([\s\S]*)\*\*$/, "$1").trim();
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishMessage, setFinishMessage] = useState<string | null>(null);
  const [panicToast, setPanicToast] = useState<string | null>(null);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const rawFeedRef = useRef<HTMLDivElement | null>(null);

  const {
    isSupported,
    isListening,
    isProcessing,
    isPanicProcessing,
    isGeneratingNotes,
    fullLectureNotes,
    generateFullNotes,
    elapsedSeconds,
    rawFeed,
    signalCards,
    panicSummary,
    error,
    startListening,
    stopListening,
    triggerPanic,
  } = useLectureListener({ language });

  const lectureMeta = useMemo(
    () => ({
      title: searchParams.get("title")?.trim() || ("Lecture Session " + id.slice(0, 8)),
      courseCode: searchParams.get("courseCode")?.trim() || "UNSPECIFIED",
    }),
    [id, searchParams],
  );

  useEffect(() => {
    if (!rawFeedRef.current) {
      return;
    }

    rawFeedRef.current.scrollTop = rawFeedRef.current.scrollHeight;
  }, [rawFeed]);

  useEffect(() => {
    if (!panicSummary) {
      return;
    }

    setShowPanicModal(true);
  }, [panicSummary]);

  const handlePanic = async () => {
    setPanicToast("Processing...");
    const summary = await triggerPanic();

    setPanicToast(summary ? "Captured the last 60 seconds." : "Unable to process panic snippet.");
    window.setTimeout(() => setPanicToast(null), 2600);
  };

  const handleFinishLecture = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setFinishMessage("Finishing lecture and generating your notes...");
    stopListening();
    const notes = await generateFullNotes({ courseCode: lectureMeta.courseCode, title: lectureMeta.title });
    if (!notes) {
      setFinishMessage("Notes were not saved because generation failed. Check the error and try again.");
      setIsFinishing(false);
      return;
    }

    try {
      const response = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          courseCode: lectureMeta.courseCode,
          title: lectureMeta.title,
          notes,
          transcript: rawFeed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this lecture.");
      setFinishMessage("Lecture notes saved to your account for 10 days. Opening Your Notes...");
      window.setTimeout(() => router.push("/notes"), 900);
    } catch (saveError) {
      setFinishMessage(saveError instanceof Error ? saveError.message : "Notes were generated but could not be saved. Please retry.");
      setIsFinishing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Lecture DVR</p>
            <h1 className="text-lg font-semibold text-white">{lectureMeta.title}</h1>
            <p className="text-sm text-gray-400">{lectureMeta.courseCode}</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              Speech language
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="max-w-[155px] rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200"
                aria-label="Speech recognition language"
              >
                <option value="en-US">English (US)</option>
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi</option>
                <option value="ur-PK">Urdu</option>
                <option value="bn-IN">Bengali</option>
                <option value="ta-IN">Tamil</option>
                <option value="te-IN">Telugu</option>
                <option value="mr-IN">Marathi</option>
                <option value="gu-IN">Gujarati</option>
                <option value="pa-IN">Punjabi</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2" aria-live="polite">
              <span className="relative flex h-3 w-3" aria-hidden>
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${
                    isListening ? "animate-ping bg-red-500" : "bg-gray-700"
                  }`}
                />
                <span
                  className={`relative inline-flex h-3 w-3 rounded-full ${
                    isListening ? "bg-red-500" : "bg-gray-700"
                  }`}
                />
              </span>
              <span className="text-sm text-gray-200">
                {isListening ? "Live Recording" : "Recording Paused"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-300" aria-live="polite">
              <Timer className="h-4 w-4" />
              <span className="font-mono">{formatElapsed(elapsedSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
            >
              {isListening ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => void handleFinishLecture()}
              disabled={isFinishing}
              className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-950 hover:bg-cyan-200 disabled:opacity-50"
            >
              {isFinishing ? "Finishing..." : "Finish Lecture"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-10">
        <aside className="rounded-xl border border-gray-800 bg-gray-900 p-4 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              The Raw Feed
            </h2>
          </div>

          <div
            ref={rawFeedRef}
            className="h-[65vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950/70 p-3 text-sm leading-relaxed text-gray-500"
          >
            {rawFeed || "Listening for lecture audio..."}
          </div>
        </aside>

        <section className="rounded-xl border border-gray-800 bg-gray-800 p-4 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-cyan-300" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-200">AI Study Notes</h2>
                <p className="mt-1 text-xs text-gray-400">Key concepts, facts, formulas, examples, exam hints, and deadlines — filler filtered out</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs text-gray-400" aria-live="polite">
                {isProcessing ? "Filtering latest chunk..." : `${signalCards.length} cards captured`}
              </span>
              <button
                type="button"
                onClick={() => void generateFullNotes()}
                disabled={isGeneratingNotes || !rawFeed.trim()}
                className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-gray-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingNotes ? "Generating notes..." : "Generate Full Lecture Notes"}
              </button>
            </div>
          </div>

          <div className="grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {signalCards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/60 p-6 text-sm text-gray-400">
                Waiting for high-value academic signals...
              </div>
            ) : (
              signalCards.map((card) => (
                <article
                  key={card.id}
                  className={`rounded-xl border p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${
                    categoryStyles[card.category]
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider">
                      {card.category.replace("_", " ")}
                    </p>
                    <span className="text-[11px] opacity-80">
                      {new Date(card.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{card.content}</p>
                </article>
              ))
            )}
          </div>
          {fullLectureNotes && (
            <section className="mt-4 rounded-xl border border-cyan-400/30 bg-gray-950/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-200">Complete Lecture Notes</h3>
                  <p className="mt-1 text-xs text-gray-400">Organized study notes generated from the captured lecture transcript.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(fullLectureNotes)}
                    className="rounded-md border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"
                  >
                    Copy notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([fullLectureNotes], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "lecture-dvr-notes.md";
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-md border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"
                  >
                    Download .md
                  </button>
                </div>
              </div>
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{fullLectureNotes}</pre>
            </section>
          )}
        </section>
      </section>

      {!isSupported && (
        <div className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,460px)] -translate-x-1/2 rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-sm text-amber-100">
          Your browser does not support Web Speech API (`webkitSpeechRecognition`).
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/20 p-4 text-sm text-red-100"
        >
          {error}
        </div>
      )}

      {finishMessage && (
        <div role="status" aria-live="polite" className="fixed left-1/2 top-20 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 p-4 text-sm text-cyan-100">
          {finishMessage}
        </div>
      )}

      {panicToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-40 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/20 px-4 py-2 text-sm text-fuchsia-100"
        >
          {panicToast}
        </div>
      )}

      {showPanicModal && panicSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-fuchsia-400/40 bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-fuchsia-200">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg font-bold uppercase tracking-widest">Wait, What?</h3>
            </div>
            <p className="mb-5 text-2xl font-semibold leading-snug text-white">
              {normalizePanicSummary(panicSummary)}
            </p>
            <button
              type="button"
              onClick={() => setShowPanicModal(false)}
              className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-4 pb-24 pt-2 text-center text-xs text-gray-600">
        Developed by Akshat Chitransh
      </footer>

      <button
        type="button"
        onClick={handlePanic}
        disabled={isPanicProcessing || !isSupported}
        className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-fuchsia-300/50 bg-gradient-to-r from-red-500 to-fuchsia-600 px-8 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_40px_-10px_rgba(236,72,153,0.7)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="inline-flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {isPanicProcessing ? "Processing..." : "Wait, What?"}
        </span>
      </button>
    </main>
  );
}
