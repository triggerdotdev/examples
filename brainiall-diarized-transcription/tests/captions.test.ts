import assert from "node:assert/strict";
import test from "node:test";

import {
  createCaptionCues,
  joinTokens,
  parseBrainiallTranscript,
  renderSrt,
  renderVtt,
} from "../src/lib/captions";

test("parses word timestamps and renders speaker-labelled SRT and VTT", () => {
  const transcript = parseBrainiallTranscript({
    text: "Olá, mundo. Bienvenidos!",
    words: [
      { word: "Olá", start: 0.1, end: 0.3, speaker: "SPEAKER_00" },
      { word: ",", start: 0.3, end: 0.35, speaker: "SPEAKER_00" },
      { word: "mundo", start: 0.4, end: 0.8, speaker: "SPEAKER_00" },
      { word: ".", start: 0.8, end: 0.9, speaker: "SPEAKER_00" },
      { word: "Bienvenidos", start: 1.2, end: 1.8, speaker: "SPEAKER_01" },
      { word: "!", start: 1.8, end: 1.9, speaker: "SPEAKER_01" },
    ],
  });

  const cues = createCaptionCues(transcript.words);
  assert.equal(cues.length, 2);
  assert.equal(
    renderSrt(cues, "pt"),
    "1\n00:00:00,100 --> 00:00:00,900\nFalante 1: Olá, mundo.\n\n" +
      "2\n00:00:01,200 --> 00:00:01,900\nFalante 2: Bienvenidos!",
  );
  assert.equal(
    renderVtt(cues, "es"),
    "WEBVTT\n\n" +
      "00:00:00.100 --> 00:00:00.900\nHablante 1: Olá, mundo.\n\n" +
      "00:00:01.200 --> 00:00:01.900\nHablante 2: Bienvenidos!",
  );
});

test("joins punctuation without introducing spaces", () => {
  assert.equal(joinTokens(["Bom", "dia", ",", "mundo", "!"]), "Bom dia, mundo!");
});

test("reconstructs text when the API text field is blank", () => {
  const transcript = parseBrainiallTranscript({
    text: "   ",
    words: [
      { word: "Hola", start: 0, end: 0.2, speaker: "A" },
      { word: ",", start: 0.2, end: 0.3, speaker: "A" },
      { word: "mundo", start: 0.3, end: 0.6, speaker: "A" },
      { word: "!", start: 0.6, end: 0.7, speaker: "A" },
    ],
  });
  assert.equal(transcript.text, "Hola, mundo!");
});

test("splits a cue after a long silence even for the same speaker", () => {
  const transcript = parseBrainiallTranscript({
    words: [
      { word: "Primeiro", start: 0, end: 0.5, speaker: 0 },
      { word: "Depois", start: 3, end: 3.5, speaker: 0 },
    ],
  });
  assert.equal(createCaptionCues(transcript.words).length, 2);
});

test("rejects responses without valid timestamped words", () => {
  assert.throws(
    () => parseBrainiallTranscript({ text: "sem timestamps", words: [] }),
    /no timestamped words/u,
  );
  assert.throws(
    () =>
      parseBrainiallTranscript({
        words: [{ word: "inválida", start: 2, end: 1, speaker: 0 }],
      }),
    /no timestamped words/u,
  );
});
