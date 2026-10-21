export type SupportedLanguage = "pt" | "es";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  speaker: string;
}

export interface Transcript {
  text: string;
  words: TranscriptWord[];
}

export interface CaptionCue {
  start: number;
  end: number;
  speaker: number;
  text: string;
}

const MAX_CUE_SECONDS = 6;
const MAX_CUE_CHARACTERS = 84;
const MAX_GAP_SECONDS = 1.5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function cleanSpeaker(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    return "unknown";
  }

  const cleaned = cleanText(String(value)).slice(0, 64);
  return cleaned || "unknown";
}

function tokenFromWord(value: Record<string, unknown>): string {
  const token =
    typeof value.word === "string"
      ? value.word
      : typeof value.text === "string"
        ? value.text
        : "";
  return cleanText(token);
}

export function parseBrainiallTranscript(value: unknown): Transcript {
  if (!isRecord(value) || !Array.isArray(value.words)) {
    throw new Error("BRAINIALL returned an invalid transcription response.");
  }

  const words: TranscriptWord[] = [];
  for (const item of value.words) {
    if (!isRecord(item)) {
      continue;
    }

    const word = tokenFromWord(item);
    const start = item.start;
    const end = item.end;
    if (
      !word ||
      typeof start !== "number" ||
      !Number.isFinite(start) ||
      start < 0 ||
      typeof end !== "number" ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      continue;
    }

    words.push({
      word,
      start,
      end,
      speaker: cleanSpeaker(item.speaker),
    });
  }

  if (words.length === 0) {
    throw new Error("BRAINIALL returned no timestamped words.");
  }

  words.sort((left, right) => left.start - right.start || left.end - right.end);
  const responseText = typeof value.text === "string" ? cleanText(value.text) : "";
  const text = responseText || joinTokens(words.map((word) => word.word));

  return { text, words };
}

export function joinTokens(tokens: string[]): string {
  let result = "";
  for (const rawToken of tokens) {
    const token = cleanText(rawToken);
    if (!token) {
      continue;
    }

    if (
      !result ||
      /^[,.;:!?%…\)\]\}]/u.test(token) ||
      /[\(\[\{¿¡]$/u.test(result)
    ) {
      result += token;
    } else {
      result += ` ${token}`;
    }
  }
  return result;
}

export function createCaptionCues(words: TranscriptWord[]): CaptionCue[] {
  if (words.length === 0) {
    return [];
  }

  const speakerNumbers = new Map<string, number>();
  const speakerNumber = (speaker: string): number => {
    const existing = speakerNumbers.get(speaker);
    if (existing !== undefined) {
      return existing;
    }
    const next = speakerNumbers.size + 1;
    speakerNumbers.set(speaker, next);
    return next;
  };

  const cues: CaptionCue[] = [];
  let currentWords: TranscriptWord[] = [];

  const flush = () => {
    if (currentWords.length === 0) {
      return;
    }
    cues.push({
      start: currentWords[0].start,
      end: currentWords[currentWords.length - 1].end,
      speaker: speakerNumber(currentWords[0].speaker),
      text: joinTokens(currentWords.map((word) => word.word)),
    });
    currentWords = [];
  };

  for (const word of words) {
    if (currentWords.length === 0) {
      currentWords.push(word);
      continue;
    }

    const first = currentWords[0];
    const previous = currentWords[currentWords.length - 1];
    const candidateText = joinTokens([...currentWords.map((item) => item.word), word.word]);
    const mustSplit =
      word.speaker !== first.speaker ||
      word.end - first.start > MAX_CUE_SECONDS ||
      word.start - previous.end > MAX_GAP_SECONDS ||
      candidateText.length > MAX_CUE_CHARACTERS;

    if (mustSplit) {
      flush();
    }
    currentWords.push(word);
  }
  flush();

  return cues;
}

function timestamp(seconds: number, separator: "," | "."): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainingMilliseconds = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}${separator}${String(remainingMilliseconds).padStart(3, "0")}`;
}

function speakerLabel(language: SupportedLanguage, speaker: number): string {
  return `${language === "pt" ? "Falante" : "Hablante"} ${speaker}`;
}

export function renderSrt(cues: CaptionCue[], language: SupportedLanguage): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${timestamp(cue.start, ",")} --> ${timestamp(cue.end, ",")}\n${speakerLabel(language, cue.speaker)}: ${cue.text}`,
    )
    .join("\n\n");
}

export function renderVtt(cues: CaptionCue[], language: SupportedLanguage): string {
  const body = cues
    .map(
      (cue) =>
        `${timestamp(cue.start, ".")} --> ${timestamp(cue.end, ".")}\n${speakerLabel(language, cue.speaker)}: ${cue.text}`,
    )
    .join("\n\n");
  return `WEBVTT\n\n${body}`;
}
