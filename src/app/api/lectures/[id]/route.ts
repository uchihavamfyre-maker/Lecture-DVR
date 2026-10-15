import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete saved lectures." }, { status: 401 });
  const { id } = await context.params;
  const result = await db.lectureSession.deleteMany({ where: { id, userId: user.id } });
  if (!result.count) return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
