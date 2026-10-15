import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await db.lectureSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return NextResponse.json({ deleted: result.count });
}
