import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to access your saved lectures." }, { status: 401 });
    await db.lectureSession.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });
    const lectures = await db.lectureSession.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() }, status: "COMPLETED" },
      orderBy: { date: "desc" },
      select: { id: true, title: true, courseCode: true, date: true, expiresAt: true, notes: true, rawTranscript: true },
    });
    return NextResponse.json({ lectures });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load your lectures.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to save lectures." }, { status: 401 });
    const body = await request.json() as { id?: string; title?: string; courseCode?: string; notes?: string; transcript?: string };
    const id = body.id?.trim();
    const title = body.title?.trim();
    const courseCode = body.courseCode?.trim();
    const notes = body.notes?.trim();
    const transcript = body.transcript?.trim() ?? "";
    if (!id || !title || !courseCode || !notes) return NextResponse.json({ error: "Lecture ID, title, subject code, and generated notes are required." }, { status: 400 });
    if (notes.length > 200_000 || transcript.length > 500_000) return NextResponse.json({ error: "This lecture is too large to save." }, { status: 413 });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const existing = await db.lectureSession.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    const data = { title: title.slice(0, 160), courseCode: courseCode.slice(0, 40), date: now, rawTranscript: transcript, notes, expiresAt, status: "COMPLETED" as const };
    const lecture = existing
      ? await db.lectureSession.update({ where: { id: existing.id }, data, select: { id: true, title: true, courseCode: true, date: true, expiresAt: true, notes: true } })
      : await db.lectureSession.create({ data: { ...data, id, userId: user.id }, select: { id: true, title: true, courseCode: true, date: true, expiresAt: true, notes: true } });
    return NextResponse.json({ lecture });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save this lecture.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
