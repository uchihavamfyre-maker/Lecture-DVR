# Lecture-DVR

Signal-to-noise lecture capture with real-time browser transcription and AI-filtered academic flashcards.

## Stack
- Next.js App Router + React
- Tailwind CSS (dark-first UI)
- Browser Web Speech API (`webkitSpeechRecognition`)
- Vercel AI SDK + OpenAI-compatible model
- Prisma + Neon PostgreSQL

## Quick Start
```bash
npx create-next-app@latest lecture-dvr --ts --app --tailwind --eslint
cd lecture-dvr
npm install prisma @prisma/client lucide-react ai @ai-sdk/openai zod
npx prisma init
```

Copy project files, then run:
```bash
npm run dev
```

## Environment Variables
Create `.env.local`:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
DATABASE_URL=postgresql://...
```

## Key Routes
- `POST /api/filter` — filters 5-minute transcript chunks into strict flashcards
- `POST /api/panic` — summarizes last ~60 seconds into one urgent sentence
- `/session/[id]` and `/dashboard/session/[id]` — mission-control recording UI

## Data Model
See `/home/runner/work/Lecture-DVR/Lecture-DVR/prisma/schema.prisma` for:
- `User`
- `LectureSession`
- `Flashcard`
- `PanicSnippet`
