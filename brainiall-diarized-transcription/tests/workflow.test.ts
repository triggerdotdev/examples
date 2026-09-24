import assert from "node:assert/strict";
import test from "node:test";

import { runDiarizedTranscription } from "../src/lib/workflow";

test("requires an explicit rights and consent confirmation before network access", async () => {
  await assert.rejects(
    runDiarizedTranscription(
      {
        audioUrl: "https://media.example.com/interview.wav",
        language: "pt",
        rightsAndConsentConfirmed: false,
      },
      { apiKey: "test-key", audioSourceHosts: "media.example.com" },
    ),
    /rights and speaker consent/u,
  );
});

test("rejects unsupported languages before network access", async () => {
  await assert.rejects(
    runDiarizedTranscription(
      {
        audioUrl: "https://media.example.com/interview.wav",
        language: "en" as "pt",
        rightsAndConsentConfirmed: true,
      },
      { apiKey: "test-key", audioSourceHosts: "media.example.com" },
    ),
    /language must be pt or es/u,
  );
});

test("requires a server-side API key before network access", async () => {
  await assert.rejects(
    runDiarizedTranscription(
      {
        audioUrl: "https://media.example.com/interview.wav",
        language: "es",
        rightsAndConsentConfirmed: true,
      },
      { apiKey: undefined, audioSourceHosts: "media.example.com" },
    ),
    /BRAINIALL_API_KEY is required/u,
  );
});
