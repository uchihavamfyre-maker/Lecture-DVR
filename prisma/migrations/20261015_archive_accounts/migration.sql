DO $$ BEGIN CREATE TYPE "LectureStatus" AS ENUM ('RECORDING','COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FlashcardCategory" AS ENUM ('DEADLINE','EXAM_HINT','FORMULA','FACT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "LectureSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawTranscript" TEXT NOT NULL,
  "notes" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "LectureStatus" NOT NULL DEFAULT 'RECORDING'
);

CREATE TABLE IF NOT EXISTS "Flashcard" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL REFERENCES "LectureSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "category" "FlashcardCategory" NOT NULL,
  "content" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isStarred" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS "PanicSnippet" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL REFERENCES "LectureSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rawText" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LectureSession_userId_idx" ON "LectureSession"("userId");
CREATE INDEX IF NOT EXISTS "LectureSession_date_idx" ON "LectureSession"("date");
CREATE INDEX IF NOT EXISTS "LectureSession_expiresAt_idx" ON "LectureSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "Flashcard_sessionId_idx" ON "Flashcard"("sessionId");
CREATE INDEX IF NOT EXISTS "Flashcard_category_idx" ON "Flashcard"("category");
CREATE INDEX IF NOT EXISTS "Flashcard_timestamp_idx" ON "Flashcard"("timestamp");
CREATE INDEX IF NOT EXISTS "PanicSnippet_sessionId_idx" ON "PanicSnippet"("sessionId");
CREATE INDEX IF NOT EXISTS "PanicSnippet_timestamp_idx" ON "PanicSnippet"("timestamp");
