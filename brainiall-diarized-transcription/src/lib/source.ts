import { isIP } from "node:net";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 2;
const DOWNLOAD_TIMEOUT_MS = 30_000;

const ALLOWED_EXTENSIONS = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
]);

const ALLOWED_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
  "video/webm",
]);

export interface DownloadedAudio {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function validateHostname(hostname: string): void {
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isIP(hostname) !== 0
  ) {
    throw new Error("Audio source hosts must be public DNS hostnames.");
  }
}

export function parseAllowedSourceHosts(value: string | undefined): Set<string> {
  const hosts = new Set<string>();
  for (const rawHost of value?.split(",") ?? []) {
    const host = rawHost.trim().toLowerCase();
    if (!host) {
      continue;
    }
    if (host.includes("://") || /[\/:?#@]/u.test(host)) {
      throw new Error("AUDIO_SOURCE_HOSTS must contain exact hostnames only.");
    }
    validateHostname(host);
    hosts.add(host);
  }

  if (hosts.size === 0) {
    throw new Error("AUDIO_SOURCE_HOSTS must allow at least one source hostname.");
  }
  return hosts;
}

export function validateAudioSourceUrl(value: string, allowedHosts: Set<string>): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("audioUrl must be a valid HTTPS URL.");
  }

  const hostname = url.hostname.toLowerCase();
  validateHostname(hostname);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !allowedHosts.has(hostname)
  ) {
    throw new Error("audioUrl is not permitted by AUDIO_SOURCE_HOSTS.");
  }
  return url;
}

function extensionFromPath(pathname: string): string {
  const filename = pathname.split("/").at(-1) ?? "";
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

function safeFilename(url: URL): string {
  const rawFilename = url.pathname.split("/").at(-1) || "audio.bin";
  let decodedFilename = rawFilename;
  try {
    decodedFilename = decodeURIComponent(rawFilename);
  } catch {
    // Keep the encoded path segment; it will be sanitized below.
  }
  const sanitized = decodedFilename
    .replace(/[^A-Za-z0-9._-]+/gu, "_")
    .replace(/^\.+/u, "")
    .slice(0, 128);
  return sanitized || "audio.bin";
}

async function safeCancel(
  target: { cancel: () => Promise<unknown> } | null | undefined,
): Promise<void> {
  try {
    await target?.cancel();
  } catch {
    // Ignore cancellation failures to preserve primary errors and prevent credential leakage
  }
}

async function readWithLimit(response: Response): Promise<Uint8Array> {
  if (!response.body) {
    throw new Error("Audio source returned an empty response.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    let readResult: ReadableStreamReadResult<Uint8Array>;
    try {
      readResult = await reader.read();
    } catch {
      await safeCancel(reader);
      throw new Error("Could not download audio from the configured source.");
    }

    const { value, done } = readResult;
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_AUDIO_BYTES) {
      await safeCancel(reader);
      throw new Error("Audio exceeds the 25 MB example limit.");
    }
    chunks.push(value);
  }

  if (total === 0) {
    throw new Error("Audio source returned an empty file.");
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function downloadAllowedAudio(
  rawUrl: string,
  allowedHosts: Set<string>,
  fetcher: FetchLike = fetch,
): Promise<DownloadedAudio> {
  let currentUrl = validateAudioSourceUrl(rawUrl, allowedHosts);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetcher(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        headers: { Accept: "audio/*,application/octet-stream;q=0.8" },
      });
    } catch {
      throw new Error("Could not download audio from the configured source.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        await safeCancel(response.body);
        throw new Error("Audio source redirect could not be followed safely.");
      }
      await safeCancel(response.body);
      currentUrl = validateAudioSourceUrl(
        new URL(location, currentUrl).toString(),
        allowedHosts,
      );
      continue;
    }

    if (!response.ok) {
      await safeCancel(response.body);
      throw new Error(`Audio source returned HTTP ${response.status}.`);
    }

    const rawContentLength = response.headers.get("content-length");
    const contentLength = rawContentLength === null ? undefined : Number(rawContentLength);
    if (
      contentLength !== undefined &&
      (!Number.isFinite(contentLength) || contentLength < 0)
    ) {
      await safeCancel(response.body);
      throw new Error("Audio source returned an invalid content length.");
    }
    if (contentLength !== undefined && contentLength > MAX_AUDIO_BYTES) {
      await safeCancel(response.body);
      throw new Error("Audio exceeds the 25 MB example limit.");
    }

    const contentType =
      response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ||
      "application/octet-stream";
    const extension = extensionFromPath(currentUrl.pathname);
    if (
      !ALLOWED_CONTENT_TYPES.has(contentType) ||
      (contentType === "application/octet-stream" && !ALLOWED_EXTENSIONS.has(extension))
    ) {
      await safeCancel(response.body);
      throw new Error("Audio source returned an unsupported media type.");
    }

    try {
      return {
        bytes: await readWithLimit(response),
        contentType,
        filename: safeFilename(currentUrl),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "Audio exceeds the 25 MB example limit." ||
          error.message === "Audio source returned an empty response." ||
          error.message === "Audio source returned an empty file." ||
          error.message === "Could not download audio from the configured source.")
      ) {
        throw error;
      }
      throw new Error("Could not download audio from the configured source.");
    }
  }

  throw new Error("Audio source redirect could not be followed safely.");
}
