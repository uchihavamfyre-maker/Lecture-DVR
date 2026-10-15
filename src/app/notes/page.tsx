"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenText, Download, FileText, Trash2 } from "lucide-react";

type SavedLecture = {
  id: string;
  courseCode: string;
  title: string;
  createdAt: string;
  notes: string;
  transcript?: string;
};

const STORAGE_KEY = "lecture-dvr-saved-notes-v1";
const RETENTION_MS = 10 * 24 * 60 * 60 * 1000;

function readSaved(): SavedLecture[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SavedLecture[];
    const cutoff = Date.now() - RETENTION_MS;
    const fresh = parsed.filter((item) => item && item.createdAt && Date.parse(item.createdAt) >= cutoff && item.notes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function NotesPage() {
  const [notes, setNotes] = useState<SavedLecture[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setNotes(readSaved()), []);

  const selectedNote = useMemo(() => notes.find((item) => item.id === selected) || null, [notes, selected]);

  const exportWeek = () => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekly = notes.filter((item) => Date.parse(item.createdAt) >= weekAgo);
    if (!weekly.length) return;
    const content = "# Lecture DVR — Weekly Lecture Notes\n\n" + weekly.map((item) =>
      "## " + item.courseCode + " — " + item.title + "\n\n" +
      "Date: " + new Date(item.createdAt).toLocaleString() + "\n\n" + item.notes
    ).join("\n\n---\n\n");
    downloadText("lecture-dvr-weekly-notes.md", content);
  };

  const deleteNote = (id: string) => {
    const next = notes.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setNotes(next);
    if (selected === id) setSelected(null);
  };

  const weekCount = notes.filter((item) => Date.parse(item.createdAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-6 text-gray-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"><ArrowLeft className="h-4 w-4" /> Back to Lecture DVR</a>
            <h1 className="flex items-center gap-3 text-3xl font-semibold"><BookOpenText className="h-7 w-7 text-cyan-300" /> Your Notes</h1>
            <p className="mt-2 text-sm text-gray-400">Your saved lecture notes stay in this browser for 10 days, then expire automatically.</p>
          </div>
          <button onClick={exportWeek} disabled={weekCount === 0} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-gray-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> Download week ({weekCount})</button>
        </header>

        <div className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-gray-300">
          <strong className="text-cyan-200">Weekly export:</strong> downloads all notes saved in the last 7 days as one Markdown file, including subject code, lecture title, date, and notes. You can open it in a Markdown editor or print/export it as a PDF.
        </div>

        {notes.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/50 p-10 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-gray-600" />
            <h2 className="text-lg font-semibold">No saved lectures yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">Start a lecture, then press Finish Lecture to generate and save its notes here.</p>
            <a href="/" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-gray-950 hover:bg-cyan-200">Start a lecture</a>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{notes.length} saved lecture{notes.length === 1 ? "" : "s"} · auto-expire after 10 days</p>
              {notes.map((item) => (
                <article key={item.id} className={"rounded-xl border p-4 transition " + (selected === item.id ? "border-cyan-400/60 bg-cyan-400/5" : "border-gray-800 bg-gray-900/70")}>
                  <button onClick={() => setSelected(item.id)} className="w-full text-left">
                    <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{item.courseCode}</p>
                    <h2 className="mt-1 font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-400">{item.notes.slice(0, 180)}</p>
                  </button>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => downloadText(item.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-lecture-notes.md", "# " + item.courseCode + " — " + item.title + "\n\n" + item.notes)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"><Download className="h-3.5 w-3.5" /> Download</button>
                    <button onClick={() => deleteNote(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:border-red-500/50 hover:text-red-200"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                </article>
              ))}
            </section>

            <section className="min-h-[50vh] rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
              {selectedNote ? (
                <>
                  <div className="mb-4 border-b border-gray-800 pb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{selectedNote.courseCode}</p>
                    <h2 className="mt-2 text-xl font-semibold">{selectedNote.title}</h2>
                    <p className="mt-2 text-xs text-gray-500">{new Date(selectedNote.createdAt).toLocaleString()}</p>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">{selectedNote.notes}</pre>
                </>
              ) : <div className="flex min-h-[40vh] items-center justify-center text-center text-sm text-gray-500">Choose a lecture to read its full notes.</div>}
            </section>
          </div>
        )}
        <footer className="mt-10 pb-6 text-center text-xs text-gray-600">Developed by Akshat Chitransh</footer>
      </div>
    </main>
  );
}
