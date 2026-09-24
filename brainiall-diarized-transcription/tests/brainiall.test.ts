import assert from "node:assert/strict";
import test from "node:test";

import { transcribeWithBrainiall } from "../src/lib/brainiall";
import type { DownloadedAudio, FetchLike } from "../src/lib/source";

const audio: DownloadedAudio = {
  bytes: new Uint8Array([1, 2, 3]),
  contentType: "audio/wav",
  filename: "interview.wav",
};

test("sends the fixed BRAINIALL multipart contract without returning the key", async () => {
  const fetcher: FetchLike = async (input, init) => {
    assert.equal(input.toString(), "https://api.brainiall.com/v1/whisper/transcribe");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("language"), "pt");
    assert.equal(init.body.get("diarize"), "true");
    const uploaded = init.body.get("audio");
    assert.ok(uploaded instanceof File);
    assert.equal(uploaded.name, "interview.wav");
    assert.equal(uploaded.type, "audio/wav");

    return Response.json({
      text: "Bom dia.",
      words: [
        { word: "Bom", start: 0, end: 0.2, speaker: "SPEAKER_00" },
        { word: "dia", start: 0.2, end: 0.4, speaker: "SPEAKER_00" },
        { word: ".", start: 0.4, end: 0.45, speaker: "SPEAKER_00" },
      ],
    });
  };

  const result = await transcribeWithBrainiall(audio, "pt", "test-key", fetcher);
  assert.equal(result.text, "Bom dia.");
  assert.equal(JSON.stringify(result).includes("test-key"), false);
});

test("maps authorization failures without returning the response body", async () => {
  const fetcher: FetchLike = async () =>
    new Response("server leaked key: should-not-surface", { status: 401 });

  await assert.rejects(
    transcribeWithBrainiall(audio, "es", "test-key", fetcher),
    (error: Error) => {
      assert.match(error.message, /rejected the API key/u);
      assert.equal(error.message.includes("should-not-surface"), false);
      return true;
    },
  );
});

test("rejects empty keys before making a request", async () => {
  let calls = 0;
  const fetcher: FetchLike = async () => {
    calls += 1;
    return Response.json({});
  };
  await assert.rejects(
    transcribeWithBrainiall(audio, "pt", "  ", fetcher),
    /BRAINIALL_API_KEY is required/u,
  );
  assert.equal(calls, 0);
});

test("redacts details from network errors", async () => {
  const fetcher: FetchLike = async () => {
    throw new Error("socket failed with Bearer test-key");
  };

  await assert.rejects(
    transcribeWithBrainiall(audio, "pt", "test-key", fetcher),
    (error: Error) => {
      assert.equal(error.message, "Could not reach the BRAINIALL transcription service.");
      assert.equal(error.message.includes("test-key"), false);
      return true;
    },
  );
});
