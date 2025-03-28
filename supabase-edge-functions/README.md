# Supabase edge functions examples

## Background

Supabase Edge functions are functions that run on the edge, close to your users. They are executed in a secure environment and have access to the same APIs as your application. They can be used to trigger a task from an external event such as a webhook, or from a database event with the payload passed through to the task. These examples will show you how to trigger tasks from both of these events.

## Examples in this repo

> Follow the official guides below to run this repo. There is also important information about [authentication with Supabase](https://trigger.dev/docs/guides/frameworks/supabase-authentication) in the Trigger.dev docs; the service role key is used rather than JWT tokens for authentication. This should be changed if you plan on using this in production.

1. `edge-function-trigger`: This function triggers a 'Hello world' task when you access the edge function URL. [Full guide for this project here](https://trigger.dev/docs/guides/frameworks/supabase-edge-functions-basic).
2. `video-processing-handler`: This function triggers a video processing task when a new row is inserted into a table. The result of the video processing task is then updated back into the table. [Full guide for this project here](https://trigger.dev/docs/guides/frameworks/supabase-edge-functions-database-webhooks).

## Docs

For more Supabase and Trigger.dev guides and examples, check out our [Supabase and Trigger.dev docs](https://trigger.dev/docs/guides/frameworks/supabase-guides-overview).
