import { task } from "@trigger.dev/sdk";
import {
  runDiarizedTranscription,
  type DiarizedTranscriptionPayload,
} from "../lib/workflow";

export const brainiallDiarizedTranscription = task({
  id: "brainiall-diarized-transcription",
  retry: { maxAttempts: 1 },
  run: async (payload: DiarizedTranscriptionPayload) =>
    runDiarizedTranscription(payload, {
      apiKey: process.env.BRAINIALL_API_KEY,
      audioSourceHosts: process.env.AUDIO_SOURCE_HOSTS,
    }),
});
