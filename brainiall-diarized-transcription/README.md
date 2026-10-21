# BRAINIALL diarized transcription to SRT and VTT

This headless Trigger.dev example downloads one explicitly authorized audio file,
transcribes it with the BRAINIALL Whisper API, separates speakers, and returns
plain text plus import-ready SRT and WebVTT captions. It accepts Brazilian
Portuguese (`pt`) and Spanish (`es`).

The task is intentionally bounded: one file, 25 MB maximum, exact source-host
allowlisting, no automatic retry of the metered transcription request, and an
explicit rights-and-consent confirmation in every payload.

## How it works

1. Trigger.dev runs `brainiall-diarized-transcription` with an HTTPS audio URL.
2. The task checks consent, language, URL, and `AUDIO_SOURCE_HOSTS` before any
   network request.
3. It follows at most two redirects, revalidating every hostname, and enforces
   the 25 MB limit while streaming even if `Content-Length` is missing.
4. It sends the bytes to the fixed BRAINIALL transcription endpoint with
   `diarize=true` and a server-side Bearer key.
5. Word timestamps are grouped into readable speaker turns and rendered as SRT
   and WebVTT.

## Prerequisites

- Node.js 22 or later
- A [Trigger.dev](https://trigger.dev) project
- A dedicated, revocable BRAINIALL API key from
  [app.brainiall.com](https://app.brainiall.com)
- An HTTPS host you control for authorized audio files

BRAINIALL transcription is metered. Check the current account terms and balance
before running the task.

## Setup

```bash
npm ci
cp .env.example .env
```

Set these values in `.env` and in the Trigger.dev project environment:

```dotenv
TRIGGER_PROJECT_REF=proj_your_project_ref
BRAINIALL_API_KEY=your_dedicated_key
AUDIO_SOURCE_HOSTS=media.example.com,my-bucket.s3.us-east-1.amazonaws.com
```

`AUDIO_SOURCE_HOSTS` accepts exact hostnames only. Schemes, paths, ports,
wildcards, localhost names, and IP literals are rejected.

Start the Trigger.dev development server:

```bash
npm run dev
```

Trigger the `brainiall-diarized-transcription` task with a payload like:

```json
{
  "audioUrl": "https://media.example.com/authorized-interview.wav",
  "language": "pt",
  "rightsAndConsentConfirmed": true
}
```

Use `"language": "es"` for Spanish. The result has this shape:

```json
{
  "language": "pt",
  "text": "...",
  "wordCount": 142,
  "speakerCount": 2,
  "srt": "1\n00:00:00,120 --> 00:00:03,400\nFalante 1: ...",
  "vtt": "WEBVTT\n\n00:00:00.120 --> 00:00:03.400\nFalante 1: ..."
}
```

## Security, privacy, and cost boundaries

- Never put `BRAINIALL_API_KEY` in source code, an audio URL, or a task payload.
  Keep it in Trigger.dev environment variables and rotate the dedicated key.
- Trigger.dev can retain task inputs and outputs. An `audioUrl`, including a
  signed query string, can therefore appear in run history. Use short-lived,
  read-only URLs and configure retention for the sensitivity of the recording.
- The audio and resulting transcript leave the source host and are processed by
  Trigger.dev and BRAINIALL. Only process content you are authorized to send,
  with any required speaker notice or consent.
- URL credentials, IP literals, private-style hostnames, unlisted hosts, unsafe
  redirects, HTML responses, empty files, and files over 25 MB fail closed.
- The task sets `maxAttempts: 1` so a platform retry cannot silently repeat a
  metered API call. Retry manually only after confirming whether the first call
  was billed.
- The task does not log the source URL, transcript, API key, or response body on
  errors. Its returned output intentionally omits the source URL and filename.

## Validate locally

The test suite uses mocked source and BRAINIALL responses; it does not need a
live key or send media over the network.

```bash
npm test
npm run typecheck
```

The tests cover caption formatting, malformed API responses, source-host
allowlisting, redirect revalidation, both size-limit paths, multipart fields,
credential-error redaction, consent, and language validation.
