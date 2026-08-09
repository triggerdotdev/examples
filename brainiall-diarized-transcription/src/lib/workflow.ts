import {
  createCaptionCues,
  renderSrt,
  renderVtt,
  type SupportedLanguage,
} from "./captions";
import { transcribeWithBrainiall } from "./brainiall";
import { downloadAllowedAudio, parseAllowedSourceHosts } from "./source";

export interface DiarizedTranscriptionPayload {
  audioUrl: string;
  language: SupportedLanguage;
  rightsAndConsentConfirmed: boolean;
}

export interface WorkflowEnvironment {
  apiKey: string | undefined;
  audioSourceHosts: string | undefined;
}

export async function runDiarizedTranscription(
  payload: DiarizedTranscriptionPayload,
  environment: WorkflowEnvironment,
) {
  if (payload.rightsAndConsentConfirmed !== true) {
    throw new Error("Confirm rights and speaker consent before processing audio.");
  }
  if (payload.language !== "pt" && payload.language !== "es") {
    throw new Error("language must be pt or es.");
  }
  if (typeof payload.audioUrl !== "string" || payload.audioUrl.length > 4096) {
    throw new Error("audioUrl must be a valid HTTPS URL.");
  }

  const apiKey = environment.apiKey?.trim();
  if (!apiKey) {
    throw new Error("BRAINIALL_API_KEY is required.");
  }

  const allowedHosts = parseAllowedSourceHosts(environment.audioSourceHosts);
  const audio = await downloadAllowedAudio(payload.audioUrl, allowedHosts);
  const transcript = await transcribeWithBrainiall(audio, payload.language, apiKey);
  const cues = createCaptionCues(transcript.words);

  return {
    language: payload.language,
    text: transcript.text,
    wordCount: transcript.words.length,
    speakerCount: new Set(transcript.words.map((word) => word.speaker)).size,
    srt: renderSrt(cues, payload.language),
    vtt: renderVtt(cues, payload.language),
  };
}
