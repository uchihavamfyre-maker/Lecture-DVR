"use client";

import { ArrowRight, AudioLines, BrainCircuit, Clock3, Radio, ShieldCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const start = () => router.push("/session/live");
  return (
    <main className="min-h-screen overflow-hidden bg-gray-950 text-gray-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(8,145,178,0.14),transparent_52%)]" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10"><AudioLines className="h-5 w-5 text-cyan-300" /></div><div><p className="font-semibold tracking-wide">LECTURE <span className="text-cyan-300">DVR</span></p><p className="text-[10px] uppercase tracking-[.25em] text-gray-500">Signal over noise</p></div></div>
        <div className="hidden items-center gap-2 rounded-full border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-400 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Local-first capture · Browser microphone</div>
      </header>
      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-medium text-cyan-200"><Zap className="h-3.5 w-3.5" /> Your lecture, decoded in real time</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl">Never lose the <span className="text-cyan-300">important part.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-gray-400">Lecture DVR listens to the lecture, keeps the raw transcript, and surfaces the academic signals worth revisiting: exam hints, deadlines, formulas, and core facts.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={start} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 font-semibold text-gray-950 transition hover:bg-cyan-200">Open lecture console <ArrowRight className="h-4 w-4" /></button><a href="#workflow" className="inline-flex items-center justify-center rounded-xl border border-gray-700 px-5 py-3.5 font-medium text-gray-300 transition hover:bg-gray-900">See how it works</a></div>
          <p className="mt-4 text-xs text-gray-600">Microphone access is requested by your browser when you start a session. AI filtering requires an API key.</p>
        </div>
        <div className="relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/5 blur-2xl" />
          <div className="relative rounded-2xl border border-gray-800 bg-gray-900/90 p-4 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4"><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-red-400" /><span className="text-xs font-semibold uppercase tracking-widest text-gray-300">Live lecture feed</span></div><span className="font-mono text-xs text-gray-500">00:18:42</span></div>
            <div className="my-4 rounded-xl border border-gray-800 bg-gray-950 p-4"><div className="mb-3 flex items-center gap-2 text-xs text-gray-500"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> TRANSCRIPT · SAMPLE PREVIEW</div><p className="text-sm leading-7 text-gray-400">“Remember this relationship for the midterm. The threshold is important, and your lab report needs to be submitted before Friday...”</p></div>
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Signal feed</span><span className="text-xs text-gray-600">AI filtered</span></div>
            <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-yellow-400/25 bg-yellow-400/5 p-3"><p className="mb-1 text-[10px] font-bold tracking-widest text-yellow-300">EXAM HINT</p><p className="text-sm text-gray-200">Relationship likely appears on the midterm.</p></div><div className="rounded-xl border border-red-400/25 bg-red-400/5 p-3"><p className="mb-1 text-[10px] font-bold tracking-widest text-red-300">DEADLINE</p><p className="text-sm text-gray-200">Lab report due before Friday.</p></div><div className="rounded-xl border border-blue-400/25 bg-blue-400/5 p-3"><p className="mb-1 text-[10px] font-bold tracking-widest text-blue-300">FORMULA</p><p className="text-sm text-gray-200">Threshold value flagged for review.</p></div><div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3"><p className="mb-1 text-[10px] font-bold tracking-widest text-cyan-300">FACT</p><p className="text-sm text-gray-200">Core definition saved as a card.</p></div></div>
          </div>
        </div>
      </section>
      <section id="workflow" className="relative mx-auto grid max-w-7xl gap-4 px-5 pb-24 sm:grid-cols-3">
        {[{icon:Radio,title:"Capture",text:"Browser speech recognition turns live lecture audio into a rolling transcript."},{icon:BrainCircuit,title:"Filter",text:"AI extracts deadlines, exam hints, formulas, and memorable academic facts."},{icon:Clock3,title:"Recover",text:"Hit “Wait, What?” to request a concise recap of the recent transcript."}].map((item) => <article key={item.title} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5"><item.icon className="mb-4 h-5 w-5 text-cyan-300" /><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{item.text}</p></article>)}
      </section>
      <footer className="relative border-t border-gray-900 px-5 py-6 text-center text-xs text-gray-600"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Lecture DVR · Developer: Akshit Das · Built to protect your attention</footer>
    </main>
  );
}
