// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { tasks } from "npm:@trigger.dev/sdk@latest/v3";
// Import the videoProcessAndUpdate task from the trigger folder
import type { videoProcessAndUpdate } from "../../../src/trigger/videoProcessAndUpdate.ts";
//     👆 type only import

// Sets up a Deno server that listens for incoming JSON requests
Deno.serve(async (req) => {
  const payload = await req.json();

  // This payload will contain the video url and id from the new row in the table
  const videoUrl = payload.record.video_url;
  const id = payload.record.id;

  // Trigger the videoProcessAndUpdate task with the videoUrl payload
  await tasks.trigger<typeof videoProcessAndUpdate>(
    "video-process-and-update",
    { videoUrl, id },
  );
  console.log(payload ?? "No name provided");

  return new Response("ok");
});
