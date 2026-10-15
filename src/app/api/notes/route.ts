import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TRANSCRIPT_CHARS = 80_000;

const SYSTEM_PROMPT = `You are an expert university lecture editor and study-note writer. Turn a noisy, imperfect speech-to-text transcript into a complete, well-organized study document.

Goals:
- Preserve the lecture's actual academic content, but remove filler, repeated phrases, false starts, classroom noise, and irrelevant chatter.
- Organize notes with a clear title, overview, topic headings, concise explanations, key definitions, important facts, mechanisms/processes, comparisons, examples, formulas with variables and units, numerical values, exceptions, exam hints, and assignment/deadline reminders.
- Identify exam hints from explicit statements such as "this will appear in the midterm". Do not invent exam predictions.
- Correct obvious speech recognition errors only when the intended technical term is clear. Never invent facts, formula values, units, dates, or details not supported by the transcript. Mark unclear points as "[unclear in transcript]" rather than guessing.
- Keep the language of the transcript. If it naturally mixes languages, preserve that mix and technical terms.
- Deduplicate repeated content and combine related points into coherent notes.
- Finish with "Quick Revision" containing the most valuable takeaways, then "Questions to Review" containing only questions grounded in unclear or important transcript material.
- Use readable Markdown. Make the notes useful for exam revision, not a verbatim transcript. If the transcript is too short, still organize the useful content and state that the source was brief.`;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string; courseCode?: string; title?: string };
    const transcript = body?.transcript?.trim();
    if (!transcript) return json({ error: "No lecture transcript has been captured yet." }, 400);
    if (!process.env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not configured." }, 500);

    const boundedTranscript = transcript.slice(-MAX_TRANSCRIPT_CHARS);
    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt: `Course: ${body.courseCode || "Not specified"}
Lecture: ${body.title || "Lecture notes"}

Create the complete study notes from this captured lecture transcript:

--- TRANSCRIPT START ---
${boundedTranscript}
--- TRANSCRIPT END ---`,
      temperature: 0.2,
    });
    const notes = result.text.trim();
    if (!notes) return json({ error: "The AI returned empty notes. Please try again." }, 502);
    return json({ notes, truncated: transcript.length > MAX_TRANSCRIPT_CHARS, transcriptCharacters: transcript.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected lecture notes failure.";
    return json({ error: message }, 500);
  }
}
