"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpenText, LogIn } from "lucide-react";

export default function AccountPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/notes");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const query = new URLSearchParams(window.location.search); const next = query.get("next") || "/notes"; const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/notes"; setNextPath(safeNext); setMode(query.get("mode") === "register" ? "register" : "login"); void fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.user) router.replace(safeNext); }).catch(() => {}); }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to authenticate.");
      router.push(nextPath); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to authenticate."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10 text-gray-100">
    <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
      <a href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-200"><ArrowLeft className="h-4 w-4" /> Back</a>
      <div className="mb-6 flex items-center gap-3"><BookOpenText className="h-8 w-8 text-cyan-300" /><div><h1 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="mt-1 text-sm text-gray-400">Access your saved lectures on any device.</p></div></div>
      <div className="mb-5 grid grid-cols-2 rounded-xl border border-gray-800 bg-gray-950 p-1"><button onClick={() => { setMode("login"); setError(null); }} className={"rounded-lg px-3 py-2 text-sm " + (mode === "login" ? "bg-gray-800 text-white" : "text-gray-500")}>Sign in</button><button onClick={() => { setMode("register"); setError(null); }} className={"rounded-lg px-3 py-2 text-sm " + (mode === "register" ? "bg-gray-800 text-white" : "text-gray-500")}>Create account</button></div>
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="email" className="mb-2 block text-sm text-gray-300">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-cyan-400" placeholder="you@example.com" /></div>
        <div><label htmlFor="password" className="mb-2 block text-sm text-gray-300">Password</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={200} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-cyan-400" placeholder="At least 10 characters" /></div>
        {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-bold text-gray-950 disabled:opacity-50"><LogIn className="h-4 w-4" />{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="mt-4 text-xs leading-5 text-gray-500">Your password is stored as a cryptographic hash. Your session cookie is HTTP-only.</p>
      <footer className="mt-8 text-center text-xs text-gray-600">Developed by Akshat Chitransh</footer>
    </section>
  </main>;
}
