"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpenText, Download, LogOut, Trash2 } from "lucide-react";

type Lecture = { id: string; title: string; courseCode: string; date: string; expiresAt: string; notes: string };

export default function NotesPage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/lectures", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { router.replace("/account"); return; }
      if (!response.ok) throw new Error(data.error || "Could not load your notes.");
      setLectures(data.lectures || []);
      setSelected((old) => old && data.lectures.some((x: Lecture) => x.id === old) ? old : data.lectures[0]?.id || null);
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setEmail(me.user?.email || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load notes."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const active = lectures.find((x) => x.id === selected) || null;
  const week = lectures.filter((x) => Date.parse(x.date) >= Date.now() - 7 * 86400000);

  function exportPdf(items: Lecture[], title: string) {
    if (!items.length) return;
    const oldTitle = document.title;
    document.title = title;
    document.body.classList.add("printing-lecture-notes");
    const printRoot = document.getElementById("lecture-notes-print-root");
    if (printRoot) {
      printRoot.innerHTML = items.map((x) => '<section class="print-lecture"><p>' + x.courseCode.replace(/[&<>]/g, "") + '</p><h1>' + x.title.replace(/[&<>]/g, "") + '</h1><p>' + new Date(x.date).toLocaleString() + '</p><pre></pre></section>').join("");
      const pre = printRoot.querySelectorAll("pre");
      pre.forEach((node, index) => { node.textContent = items[index].notes; });
      printRoot.style.display = "block";
      window.print();
      printRoot.style.display = "none";
      printRoot.innerHTML = "";
    }
    document.body.classList.remove("printing-lecture-notes");
    document.title = oldTitle;
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this lecture permanently?")) return;
    const response = await fetch("/api/lectures/" + encodeURIComponent(id), { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Delete failed."); return; }
    const next = lectures.filter((x) => x.id !== id); setLectures(next);
    if (selected === id) setSelected(next[0]?.id || null);
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/account"); router.refresh(); }

  return <main className="min-h-screen bg-gray-950 px-4 py-6 text-gray-100 sm:px-6">
    <style jsx global>{`@media print { body.printing-lecture-notes > * { display:none!important } body.printing-lecture-notes #lecture-notes-print-root { display:block!important; color:#111; background:#fff; padding:18mm; font:11pt/1.6 Arial,sans-serif } .print-lecture { break-after:page; } .print-lecture h1 { font-size:22pt; margin:8px 0 } .print-lecture p:first-child { color:#087e8b; font-weight:bold; letter-spacing:2px } .print-lecture pre { white-space:pre-wrap; overflow-wrap:anywhere; font:10pt/1.6 Arial,sans-serif } }`}</style>
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><a href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-200"><ArrowLeft className="h-4 w-4" /> Back to Lecture DVR</a><h1 className="flex items-center gap-3 text-3xl font-semibold"><BookOpenText className="h-7 w-7 text-cyan-300" /> Your Notes</h1><p className="mt-2 text-sm text-gray-400">{email ? "Signed in as " + email + " · " : ""}Synced to your account · 10-day retention</p></div><div className="flex gap-2"><button onClick={() => exportPdf(week, "Lecture DVR - Weekly Notes")} disabled={!week.length} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-gray-950 disabled:opacity-40"><Download className="h-4 w-4" /> Weekly PDF ({week.length})</button><button onClick={logout} className="rounded-xl border border-gray-700 px-3 py-3 text-sm text-gray-300"><LogOut className="h-4 w-4" /></button></div></header>
      <div className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm text-gray-300">Your notes are stored in the shared database and expire after 10 days. PDF export opens the print dialog; choose <b>Save as PDF</b>.</div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error} <button onClick={() => void load()} className="underline">Retry</button></div>}
      {loading ? <p className="p-10 text-center text-gray-400">Loading your notes…</p> : !lectures.length ? <section className="rounded-2xl border border-dashed border-gray-700 p-10 text-center"><h2 className="text-lg font-semibold">No saved lectures yet</h2><p className="mt-2 text-sm text-gray-400">Finish a lecture to save its notes here.</p><a href="/" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-3 font-bold text-gray-950">Start a lecture</a></section> : <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="space-y-3">{lectures.map((x) => <article key={x.id} className={"rounded-xl border p-4 " + (selected === x.id ? "border-cyan-400/60 bg-cyan-400/5" : "border-gray-800 bg-gray-900/70")}><button onClick={() => setSelected(x.id)} className="w-full text-left"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{x.courseCode}</p><h2 className="mt-1 font-semibold">{x.title}</h2><p className="mt-2 text-xs text-gray-500">{new Date(x.date).toLocaleString()} · Expires {new Date(x.expiresAt).toLocaleDateString()}</p><p className="mt-2 line-clamp-2 text-sm text-gray-400">{x.notes.slice(0,160)}</p></button><div className="mt-3 flex justify-end gap-2"><button onClick={() => exportPdf([x], x.courseCode + " - " + x.title)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs">Export PDF</button><button onClick={() => void remove(x.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-400"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div></article>)}</section><section className="min-h-[50vh] rounded-2xl border border-gray-800 bg-gray-900/70 p-5">{active ? <><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{active.courseCode}</p><h2 className="mt-2 text-xl font-semibold">{active.title}</h2><p className="mt-2 border-b border-gray-800 pb-4 text-xs text-gray-500">{new Date(active.date).toLocaleString()}</p><pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{active.notes}</pre><button onClick={() => exportPdf([active], active.courseCode + " - " + active.title)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-gray-950"><Download className="h-4 w-4" /> Export PDF</button></> : <p className="p-10 text-center text-gray-500">Select a lecture.</p>}</section></div>}
      <div id="lecture-notes-print-root" style={{display:"none"}} />
      <footer className="mt-10 text-center text-xs text-gray-600">Developed by Akshat Chitransh</footer>
    </div>
  </main>;
}
