import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const PANIC_PROMPT =
  "Summarize this urgent 60-second lecture snippet into one concise, bolded sentence. The student just zoned out and needs to know exactly what the professor just said.";

const panicResponseSchema = z.object({
  summary: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body?.transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const result = await generateObject({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      schema: panicResponseSchema,
      system:
        "You are an urgent academic assistant. Return strictly valid JSON with a single `summary` field.",
      prompt: `${PANIC_PROMPT}\n\nSnippet:\n${transcript}`,
      temperature: 0.2,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected panic failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
