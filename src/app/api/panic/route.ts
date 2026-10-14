import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const PANIC_PROMPT =
  "Summarize this urgent 60-second lecture snippet into one concise, bolded sentence. The student just zoned out and needs to know exactly what the professor just said.";

const MAX_TRANSCRIPT_CHARS = 8_000;

const panicResponseSchema = z.object({
  summary: z.string().min(1),
});

function responseWithNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function ensureBoldSentence(summary: string): string {
  const normalized = summary.replace(/\s+/g, " ").trim();

  if (/^\*\*.*\*\*$/.test(normalized)) {
    return normalized;
  }

  return `**${normalized.replace(/^\*+|\*+$/g, "")}**`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body?.transcript?.trim();

    if (!transcript) {
      return responseWithNoStore({ error: "transcript is required" }, 400);
    }

    if (!process.env.OPENAI_API_KEY) {
      return responseWithNoStore({ error: "OPENAI_API_KEY is not configured" }, 500);
    }

    const boundedTranscript = transcript.slice(-MAX_TRANSCRIPT_CHARS);

    const result = await generateObject({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      schema: panicResponseSchema,
      system:
        "You are an urgent academic assistant. Return strictly valid JSON with a single `summary` field.",
      prompt: `${PANIC_PROMPT}\n\nSnippet:\n${boundedTranscript}`,
      temperature: 0.2,
    });

    return responseWithNoStore({ summary: ensureBoldSentence(result.object.summary) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected panic failure";
    return responseWithNoStore({ error: message }, 500);
  }
}
