import { parseBrainiallTranscript, type SupportedLanguage, type Transcript } from "./captions";
import type { DownloadedAudio, FetchLike } from "./source";

const BRAINIALL_TRANSCRIBE_URL = "https://api.brainiall.com/v1/whisper/transcribe";
const TRANSCRIPTION_TIMEOUT_MS = 180_000;

function safeApiError(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error("BRAINIALL rejected the API key.");
  }
  if (status === 402) {
    return new Error("BRAINIALL account has insufficient balance.");
  }
  if (status === 413) {
    return new Error("BRAINIALL rejected the audio size.");
  }
  if (status === 429) {
    return new Error("BRAINIALL rate limit reached.");
  }
  if (status >= 500) {
    return new Error("BRAINIALL service is temporarily unavailable.");
  }
  return new Error(`BRAINIALL transcription failed with HTTP ${status}.`);
}

export async function transcribeWithBrainiall(
  audio: DownloadedAudio,
  language: SupportedLanguage,
  apiKey: string,
  fetcher: FetchLike = fetch,
): Promise<Transcript> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("BRAINIALL_API_KEY is required.");
  }

  const uploadBytes = new Uint8Array(audio.bytes.byteLength);
  uploadBytes.set(audio.bytes);
  const form = new FormData();
  form.set(
    "audio",
    new Blob([uploadBytes.buffer], { type: audio.contentType }),
    audio.filename,
  );
  form.set("language", language);
  form.set("diarize", "true");

  let response: Response;
  try {
    response = await fetcher(BRAINIALL_TRANSCRIBE_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } catch {
    throw new Error("Could not reach the BRAINIALL transcription service.");
  }

  if (!response.ok) {
    const error = safeApiError(response.status);
    await response.body?.cancel();
    throw error;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("BRAINIALL returned invalid JSON.");
  }
  return parseBrainiallTranscript(payload);
}
