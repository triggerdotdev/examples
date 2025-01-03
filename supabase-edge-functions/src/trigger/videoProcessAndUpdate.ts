// Install any missing dependencies below
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { Readable } from "node:stream";
import os from "os";
import path from "path";
import { Database } from "../../database.types";

// Create a single Supabase client for interacting with your database
// 'Database' supplies the type definitions to supabase-js
const supabase = createSupabaseClient<Database>(
  // These details can be found in your Supabase project settings under `API`
  process.env.SUPABASE_PROJECT_URL as string, // e.g. https://abc123.supabase.co - replace 'abc123' with your project ID
  process.env.SUPABASE_SERVICE_ROLE_KEY as string, // Your service role secret key
);

// Your DEEPGRAM_SECRET_KEY can be found in your Deepgram dashboard
const deepgram = createDeepgramClient(process.env.DEEPGRAM_SECRET_KEY);

export const videoProcessAndUpdate = task({
  id: "video-process-and-update",
  run: async (payload: { videoUrl: string; id: number }) => {
    const { videoUrl, id } = payload;

    logger.log(`Processing video at URL: ${videoUrl}`);

    // Generate temporary file names
    const tempDirectory = os.tmpdir();
    const outputPath = path.join(tempDirectory, `audio_${Date.now()}.wav`);

    // Fetch the video
    const response = await fetch(videoUrl);

    // Extract the audio
    await new Promise((resolve, reject) => {
      if (!response.body) {
        return reject(new Error("Failed to fetch video"));
      }

      ffmpeg(Readable.from(response.body))
        .outputOptions([
          "-vn", // Disable video output
          "-acodec pcm_s16le", // Use PCM 16-bit little-endian encoding
          "-ar 44100", // Set audio sample rate to 44.1 kHz
          "-ac 2", // Set audio channels to stereo
        ])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    logger.log(`Audio extracted from video`, { outputPath });

    // Transcribe the audio using Deepgram
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      fs.readFileSync(outputPath),
      {
        model: "nova-2", // Use the Nova 2 model
        smart_format: true, // Automatically format the transcription
        diarize: true, // Enable speaker diarization
      },
    );

    if (error) {
      throw error;
    }

    // Convert the result object to a string
    const transcription = result.results.channels[0].alternatives[0].paragraphs
      ?.transcript;

    logger.log(`Transcription: ${transcription}`);

    // Delete the temporary audio file
    fs.unlinkSync(outputPath);
    logger.log(`Temporary audio file deleted`, { outputPath });

    const { error: updateError } = await supabase
      .from("video_transcriptions")
      // Set the plan to the new plan and update the timestamp
      .update({ transcription: transcription, video_url: videoUrl })
      // Find the row by its ID
      .eq("id", id);

    if (updateError) {
      throw new Error(`Failed to update transcription: ${updateError.message}`);
    }

    return {
      message: `Summary of the audio: ${transcription}`,
      result,
    };
  },
});
