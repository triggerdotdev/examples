import assert from "node:assert/strict";
import test from "node:test";

import {
  downloadAllowedAudio,
  MAX_AUDIO_BYTES,
  parseAllowedSourceHosts,
  validateAudioSourceUrl,
  type FetchLike,
} from "../src/lib/source";

test("accepts only exact allowlisted public HTTPS hosts", () => {
  const hosts = parseAllowedSourceHosts("media.example.com, cdn.example.com");
  assert.equal(
    validateAudioSourceUrl("https://media.example.com/interview.wav", hosts).hostname,
    "media.example.com",
  );
  assert.throws(
    () => validateAudioSourceUrl("http://media.example.com/interview.wav", hosts),
    /not permitted/u,
  );
  assert.throws(
    () => validateAudioSourceUrl("https://user:pass@media.example.com/interview.wav", hosts),
    /not permitted/u,
  );
  assert.throws(
    () => validateAudioSourceUrl("https://other.example.com/interview.wav", hosts),
    /not permitted/u,
  );
  assert.throws(
    () => parseAllowedSourceHosts("127.0.0.1"),
    /public DNS hostnames/u,
  );
});

test("downloads allowed audio without exposing the query in its result", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const fetcher: FetchLike = async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });

  const result = await downloadAllowedAudio(
    "https://media.example.com/reunião.wav?signature=short-lived",
    hosts,
    fetcher,
  );
  assert.deepEqual([...result.bytes], [1, 2, 3]);
  assert.equal(result.contentType, "audio/wav");
  assert.equal(result.filename, "reuni_o.wav");
  assert.equal(JSON.stringify(result).includes("signature"), false);
});

test("redacts source URLs from network errors", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const fetcher: FetchLike = async () => {
    throw new Error("failed at https://media.example.com/file.wav?secret=abc");
  };

  await assert.rejects(
    downloadAllowedAudio(
      "https://media.example.com/file.wav?secret=abc",
      hosts,
      fetcher,
    ),
    (error: Error) => {
      assert.equal(error.message, "Could not download audio from the configured source.");
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );
});

test("redacts source URLs from response body read errors", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(
        new Error("stream read error at https://media.example.com/file.wav?sig=SUPERSECRET"),
      );
    },
  });
  const fetcher: FetchLike = async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });

  await assert.rejects(
    downloadAllowedAudio(
      "https://media.example.com/file.wav?sig=SUPERSECRET",
      hosts,
      fetcher,
    ),
    (error: Error) => {
      assert.equal(error.message, "Could not download audio from the configured source.");
      assert.equal(error.message.includes("SUPERSECRET"), false);
      return true;
    },
  );
});

test("redacts source URLs from reader cancellation errors", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_AUDIO_BYTES + 1));
    },
    cancel() {
      throw new Error(
        "cancellation error at https://media.example.com/file.wav?sig=SUPERSECRET",
      );
    },
  });
  const fetcher: FetchLike = async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });

  await assert.rejects(
    downloadAllowedAudio(
      "https://media.example.com/file.wav?sig=SUPERSECRET",
      hosts,
      fetcher,
    ),
    (error: Error) => {
      assert.equal(error.message, "Audio exceeds the 25 MB example limit.");
      assert.equal(error.message.includes("SUPERSECRET"), false);
      return true;
    },
  );
});

test("revalidates every redirect against the hostname allowlist", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com,cdn.example.com");
  const seen: string[] = [];
  const fetcher: FetchLike = async (input) => {
    const url = input.toString();
    seen.push(url);
    if (seen.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.com/final.mp3" },
      });
    }
    return new Response(new Uint8Array([4, 5]), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  };

  await downloadAllowedAudio("https://media.example.com/start.mp3", hosts, fetcher);
  assert.deepEqual(seen, [
    "https://media.example.com/start.mp3",
    "https://cdn.example.com/final.mp3",
  ]);

  const unsafeRedirect: FetchLike = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://unlisted.example.net/audio.mp3" },
    });
  await assert.rejects(
    downloadAllowedAudio("https://media.example.com/start.mp3", hosts, unsafeRedirect),
    /not permitted/u,
  );
});

test("rejects oversized audio before reading a declared body", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const fetcher: FetchLike = async () =>
    new Response(new Uint8Array([1]), {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "content-length": String(MAX_AUDIO_BYTES + 1),
      },
    });

  await assert.rejects(
    downloadAllowedAudio("https://media.example.com/large.wav", hosts, fetcher),
    /25 MB/u,
  );
});

test("rejects malformed declared content lengths", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const fetcher: FetchLike = async () =>
    new Response(new Uint8Array([1]), {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "content-length": "not-a-number",
      },
    });

  await assert.rejects(
    downloadAllowedAudio("https://media.example.com/audio.wav", hosts, fetcher),
    /invalid content length/u,
  );
});

test("enforces the size limit while streaming when content-length is absent", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_AUDIO_BYTES));
      controller.enqueue(new Uint8Array([1]));
      controller.close();
    },
  });
  const fetcher: FetchLike = async () =>
    new Response(body, {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });

  await assert.rejects(
    downloadAllowedAudio("https://media.example.com/stream.wav", hosts, fetcher),
    /25 MB/u,
  );
});

test("rejects HTML or a generic response without an audio extension", async () => {
  const hosts = parseAllowedSourceHosts("media.example.com");
  const htmlFetcher: FetchLike = async () =>
    new Response("login", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  await assert.rejects(
    downloadAllowedAudio("https://media.example.com/login", hosts, htmlFetcher),
    /unsupported media type/u,
  );
});
