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
  const tokens = source.trim().split(/\s+/);

  if (tokens.length <= maxWords) {
    return tokens.join(" ");
  }

  return tokens.slice(tokens.length - maxWords).join(" ");
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
    language = "en-US",
    autoStart = true,
    onPanicSummary,
    onError,
  } = options;

  const recognitionRef = useRef<ReturnType<SpeechRecognitionConstructor> | null>(null);
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
      : payload && typeof payload === "object" && Array.isArray((payload as { cards?: unknown[] }).cards)
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

    const chunkToProcess = transcriptBuffer.current.trim();
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
        throw new Error(`Filter request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const cards = normalizeCards(payload);

      if (cards.length > 0) {
        setSignalCards((previous) => [...previous, ...cards]);
      }
    } catch (chunkError) {
      const message =
        chunkError instanceof Error ? chunkError.message : "Failed to process lecture chunk.";
      reportError(message);
    } finally {
      chunkInFlight.current = false;
      setIsProcessing(false);
    }
  }, [minChunkLength, normalizeCards, reportError]);

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
          transcriptBuffer.current += finalChunk;
          rollingAudioLog.current = trimToLastWords(
            `${rollingAudioLog.current} ${finalChunk}`,
            rollingWordLimit,
          );
          setRawCommitted((previous) => `${previous} ${finalChunk}`.trim());
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
            // no-op; browser sometimes blocks rapid restarts
          }
        }, 250);
      };

      recognitionRef.current = recognition;
    }

    shouldRestart.current = true;

    try {
      recognitionRef.current.start();
    } catch {
      // no-op: start can throw if called while already started
    }
  }, [SpeechRecognitionClass, language, reportError, rollingWordLimit]);

  const stopListening = useCallback(() => {
    shouldRestart.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setRawInterim("");
  }, []);

  const triggerPanic = useCallback(async (): Promise<string | null> => {
    const snippet = trimToLastWords(rollingAudioLog.current, panicWordCount);

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
        throw new Error(`Panic request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const summary =
        typeof payload === "string"
          ? payload
          : payload && typeof payload === "object" && typeof (payload as { summary?: unknown }).summary === "string"
            ? ((payload as { summary: string }).summary ?? "").trim()
            : "";

      if (!summary) {
        throw new Error("Panic summary was empty.");
      }

      setPanicSummary(summary);
      onPanicSummary?.(summary);
      return summary;
    } catch (panicError) {
      const message = panicError instanceof Error ? panicError.message : "Panic extraction failed.";
      reportError(message);
      return null;
    } finally {
      setIsPanicProcessing(false);
    }
  }, [onPanicSummary, panicWordCount, reportError]);

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
