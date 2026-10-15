import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const FILTER_SYSTEM_PROMPT = `You are Aura, an expert lecture note-taker for university students. You receive a chunk of imperfect speech-to-text from a real lecture. Speech may contain filler, repetition, false starts, transcription errors, side conversations, jokes, and ordinary explanations.

Extract compact, high-value study notes from what the professor actually teaches, even when they never explicitly say "this is important". Prioritize definitions, what something does and why, mechanisms/processes, cause-and-effect relationships, comparisons, clarifying examples, named structures, scientific facts, formulas and variable meanings, numerical values/thresholds, exceptions, explicit exam hints, and deadlines/assignment instructions.

Discard filler, repeated sentences, false starts, classroom noise, unrelated anecdotes, and generic statements that add no study value. Do not invent facts, formulas, dates, numerical values, or exam predictions. Correct obvious speech-to-text errors only when the intended academic term is clear. If uncertain, phrase cautiously rather than guessing.

Return only a JSON array of concise, self-contained cards. Use exactly one category per card:
- 'CONCEPT': useful definition, explanation, mechanism, relationship, or comparison
- 'FACT': concrete academic fact or key point to memorize
- 'FORMULA': equation, variable meaning, scientific value, unit, or threshold; preserve exact values from the transcript
- 'EXAMPLE': specific example that helps explain a concept
- 'EXAM_HINT': explicit exam/test hint or clearly stated assessment focus; do not infer an exam prediction without evidence
- 'DEADLINE': assignment, lab, submission, date, time, or requirement

Each card should usually be one or two concise sentences, preserve essential context, and avoid repetition. Merge closely related statements when that makes a clearer note. If the chunk contains no useful academic information, return an empty array.

Example output:
[
  {"category":"CONCEPT","content":"Mitochondria generate most of the cell's ATP through cellular respiration."},
  {"category":"FORMULA","content":"The professor stated the threshold is 5.2; the transcript did not specify a unit."},
  {"category":"DEADLINE","content":"Submit the lab report before Friday's final session."}
]`;

const MAX_TRANSCRIPT_CHARS = 20_000;

const filterCardSchema = z.object({
  category: z.enum(["DEADLINE", "EXAM_HINT", "FORMULA", "FACT", "CONCEPT", "EXAMPLE"]),
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
