# Supabase edge functions

This project contains two examples demonstrating how to trigger tasks using Supabase edge functions.

1. `edge-function-trigger`: This function triggers a 'Hello world' task when you access the edge function URL. [Full guide here](https://trigger.dev/docs/guides/frameworks/supabase-edge-functions-basic).
2. `video-processing-handler`: This function triggers a video processing task when a new row is inserted into a table. The result of the video processing task is then updated back into the table. [Full guide here](https://trigger.dev/docs/guides/frameworks/supabase-edge-functions-database-webhooks).
