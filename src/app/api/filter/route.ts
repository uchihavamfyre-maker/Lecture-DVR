import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const FILTER_SYSTEM_PROMPT = `You are 'Aura', a ruthless, hyper-efficient academic AI filter. You are processing a 5-minute raw audio transcript from a university lecture.
Your sole objective is to protect the student's time. Ignore all personal anecdotes, off-topic rambling, jokes, and administrative complaints.

Analyze the text and extract ONLY actionable academic data into a strict JSON array.
If the transcript contains only gibberish or noise with no academic value, return an empty array: []

You are restricted to categorizing data into one of these four tags:
1. 'EXAM_HINT': Direct mentions of what will be on a test, quiz, or midterm.
2. 'DEADLINE': Dates, times, or requirements for upcoming assignments and labs.
3. 'FORMULA': Mathematical equations, variables, or specific scientific thresholds.
4. 'FACT': A core syllabus definition or hard academic fact that must be memorized.

Return ONLY valid JSON. Format your output exactly like this example:
[
  {
    "category": "EXAM_HINT",
    "content": "The professor explicitly stated that fluid flow dynamics and Reynolds Number calculations will be a 10-mark question on the midterm."
  },
  {
    "category": "DEADLINE",
    "content": "Lab reports for the current mushroom chamber module are due next Tuesday by 5:00 PM on the portal."
  }
]`;

const MAX_TRANSCRIPT_CHARS = 20_000;

const filterCardSchema = z.object({
  category: z.enum(["DEADLINE", "EXAM_HINT", "FORMULA", "FACT"]),
  content: z.string().min(1),
});

function responseWithNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeCardContent(content: string): string {
  return content.replace(/\s+/g, " ").trim();
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
      output: "array",
      schema: filterCardSchema,
      system: FILTER_SYSTEM_PROMPT,
      prompt: `Lecture transcript chunk:\n\n${boundedTranscript}`,
      temperature: 0.2,
    });

    const deduped = new Set<string>();
    const cards = result.object
      .map((card) => ({
        category: card.category,
        content: normalizeCardContent(card.content),
      }))
      .filter((card) => {
        if (!card.content) {
          return false;
        }

        const signature = `${card.category}:${card.content.toLowerCase()}`;
        if (deduped.has(signature)) {
          return false;
        }

        deduped.add(signature);
        return true;
      });

    return responseWithNoStore(cards);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected filter failure";
    return responseWithNoStore({ error: message }, 500);
  }
}
