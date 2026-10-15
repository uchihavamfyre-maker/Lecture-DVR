"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type FlashcardCategory = "DEADLINE" | "EXAM_HINT" | "FORMULA" | "FACT";

export interface SignalCard {
  id: string;
  category: FlashcardCategory;
  content: string;
  createdAt: string;
}

export interface UseLectureListenerOptions {
  filterIntervalMs?: number;
  minChunkLength?: number;
  rollingWordLimit?: number;
  panicWordCount?: number;
  maxChunkChars?: number;
  maxRawFeedWords?: number;
  language?: string;
  autoStart?: boolean;
  onPanicSummary?: (summary: string) => void;
  onError?: (errorMessage: string) => void;
}

export interface UseLectureListenerResult {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isPanicProcessing: boolean;
  elapsedSeconds: number;
  rawFeed: string;
  signalCards: SignalCard[];
  panicSummary: string | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  triggerPanic: () => Promise<string | null>;
  clearSignalCards: () => void;
}

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function trimToLastWords(source: string, maxWords: number): string {
  const tokens = source.trim().split(/\s+/).filter(Boolean);

  if (tokens.length <= maxWords) {
    return tokens.join(" ");
  }

  return tokens.slice(tokens.length - maxWords).join(" ");
}

function trimToLastChars(source: string, maxChars: number): string {
  const normalized = source.trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return normalized.slice(normalized.length - maxChars);
}


/**
 * SpeechRecognition can resend overlapping final results after a mobile-browser
 * restart. Remove the longest suffix/prefix overlap before appending text.
 */
function appendWithoutOverlap(existing: string, incoming: string): string {
  const left = existing.trim();
  const right = incoming.trim();

  if (!left) return right;
  if (!right) return left;

  const leftWords = left.split(/\s+/);
  const rightWords = right.split(/\s+/);
  const comparable = (word: string) => word.toLocaleLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const maxOverlap = Math.min(leftWords.length, rightWords.length, 40);

  for (let size = maxOverlap; size > 0; size -= 1) {
    const suffix = leftWords.slice(-size).map(comparable);
    const prefix = rightWords.slice(0, size).map(comparable);
    if (suffix.every((word, index) => word === prefix[index])) {
      return [...leftWords, ...rightWords.slice(size)].join(" ");
    }
  }

  return `${left} ${right}`;
}

function safeUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useLectureListener(
  options: UseLectureListenerOptions = {},
): UseLectureListenerResult {
  const {
    filterIntervalMs = 300_000,
    minChunkLength = 50,
    rollingWordLimit = 1_500,
    panicWordCount = 200,
    maxChunkChars = 12_000,
    maxRawFeedWords = 2_500,
    language = "en-US",
    autoStart = true,
    onPanicSummary,
    onError,
  } = options;

  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const transcriptBuffer = useRef("");
  const rollingAudioLog = useRef("");
  const shouldRestart = useRef(false);
  const chunkInFlight = useRef(false);
  const startTimestamp = useRef<number | null>(null);
  const processingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPanicProcessing, setIsPanicProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rawCommitted, setRawCommitted] = useState("");
  const [rawInterim, setRawInterim] = useState("");
  const [signalCards, setSignalCards] = useState<SignalCard[]>([]);
  const [panicSummary, setPanicSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognitionClass = useMemo<SpeechRecognitionConstructor | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return (
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition ??
      null
    );
  }, []);

  const isSupported = Boolean(SpeechRecognitionClass);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError],
  );

  const normalizeCards = useCallback((payload: unknown): SignalCard[] => {
    const entries = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { cards?: unknown[] }).cards)
        ? (payload as { cards: unknown[] }).cards
        : [];

    return entries
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const category = (item as { category?: string }).category;
        const content = (item as { content?: string }).content;

        if (
          !category ||
          !content ||
          !["DEADLINE", "EXAM_HINT", "FORMULA", "FACT"].includes(category)
        ) {
          return null;
        }

        return {
          id: safeUniqueId("card"),
          category: category as FlashcardCategory,
          content: content.trim(),
          createdAt: new Date().toISOString(),
        } satisfies SignalCard;
      })
      .filter((card): card is SignalCard => Boolean(card));
  }, []);

  const processTranscriptChunk = useCallback(async () => {
    if (chunkInFlight.current) {
      return;
    }

    if (transcriptBuffer.current.trim().length <= minChunkLength) {
      return;
    }

    const chunkToProcess = trimToLastChars(transcriptBuffer.current, maxChunkChars);
    transcriptBuffer.current = "";
    chunkInFlight.current = true;
    setIsProcessing(true);

    try {
      const response = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: chunkToProcess }),
      });

      if (!response.ok) {
        const details = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(details?.error || `Filter request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const cards = normalizeCards(payload);

      if (cards.length > 0) {
        setSignalCards((previous) => [...previous, ...cards]);
      }
    } catch (chunkError) {
      const message =
        chunkError instanceof Error
          ? chunkError.message
          : "Failed to process lecture chunk.";
      reportError(message);
    } finally {
      chunkInFlight.current = false;
      setIsProcessing(false);
    }
  }, [maxChunkChars, minChunkLength, normalizeCards, reportError]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) {
      reportError("Speech recognition is not supported in this browser.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);

        if (!startTimestamp.current) {
          startTimestamp.current = Date.now();
        }
      };

      recognition.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim();

          if (!transcript) {
            continue;
          }

          if (result.isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interimChunk += `${transcript} `;
          }
        }

        if (finalChunk) {
          transcriptBuffer.current = trimToLastChars(appendWithoutOverlap(transcriptBuffer.current, finalChunk), maxChunkChars);
          rollingAudioLog.current = trimToLastWords(appendWithoutOverlap(rollingAudioLog.current, finalChunk), rollingWordLimit);
          setRawCommitted((previous) => trimToLastWords(appendWithoutOverlap(previous, finalChunk), maxRawFeedWords));
        }

        setRawInterim(interimChunk.trim());
      };

      recognition.onerror = (event) => {
        reportError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        setIsListening(false);
        setRawInterim("");

        if (!shouldRestart.current) {
          return;
        }

        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // no-op; browser can block aggressive restarts
          }
        }, 250);
      };

      recognitionRef.current = recognition;
    }

    shouldRestart.current = true;

    try {
      recognitionRef.current.start();
    } catch {
      // no-op: start throws if already active
    }
  }, [
    SpeechRecognitionClass,
    language,
    maxChunkChars,
    maxRawFeedWords,
    reportError,
    rollingWordLimit,
  ]);

  const stopListening = useCallback(() => {
    shouldRestart.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setRawInterim("");
  }, []);

  const triggerPanic = useCallback(async (): Promise<string | null> => {
    const snippet = trimToLastChars(
      trimToLastWords(rollingAudioLog.current, panicWordCount),
      maxChunkChars,
    );

    if (!snippet) {
      reportError("Not enough audio context captured yet.");
      return null;
    }

    setIsPanicProcessing(true);

    try {
      const response = await fetch("/api/panic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: snippet }),
      });

      if (!response.ok) {
        const details = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(details?.error || `Panic request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const summary =
        typeof payload === "string"
          ? payload
          : payload &&
                typeof payload === "object" &&
                typeof (payload as { summary?: unknown }).summary === "string"
            ? ((payload as { summary: string }).summary ?? "").trim()
            : "";

      if (!summary) {
        throw new Error("Panic summary was empty.");
      }

      setPanicSummary(summary);
      onPanicSummary?.(summary);
      return summary;
    } catch (panicError) {
      const message =
        panicError instanceof Error ? panicError.message : "Panic extraction failed.";
      reportError(message);
      return null;
    } finally {
      setIsPanicProcessing(false);
    }
  }, [maxChunkChars, onPanicSummary, panicWordCount, reportError]);

  const clearSignalCards = useCallback(() => {
    setSignalCards([]);
  }, []);

  useEffect(() => {
    if (!autoStart || !isSupported) {
      return;
    }

    startListening();

    return () => {
      stopListening();
    };
  }, [autoStart, isSupported, startListening, stopListening]);

  useEffect(() => {
    if (!isListening) {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
      return;
    }

    processingInterval.current = setInterval(() => {
      void processTranscriptChunk();
    }, filterIntervalMs);

    return () => {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
        processingInterval.current = null;
      }
    };
  }, [filterIntervalMs, isListening, processTranscriptChunk]);

  useEffect(() => {
    const ticker = setInterval(() => {
      if (!startTimestamp.current || !isListening) {
        return;
      }

      setElapsedSeconds(Math.floor((Date.now() - startTimestamp.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(ticker);
    };
  }, [isListening]);

  useEffect(() => {
    return () => {
      shouldRestart.current = false;
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
      recognitionRef.current?.stop();
    };
  }, []);

  const rawFeed = rawInterim ? `${rawCommitted} ${rawInterim}`.trim() : rawCommitted;

  return {
    isSupported,
    isListening,
    isProcessing,
    isPanicProcessing,
    elapsedSeconds,
    rawFeed,
    signalCards,
    panicSummary,
    error,
    startListening,
    stopListening,
    triggerPanic,
    clearSignalCards,
  };
}
