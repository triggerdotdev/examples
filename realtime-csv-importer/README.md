## Trigger.dev + Next.js Realtime CSV Importer example

https://github.com/user-attachments/assets/25160343-6663-452c-8a27-819c3fd7b8df

This demo is a full stack example that demonstrates how to use Trigger.dev Realtime to a CSV Uploader with live progress updates. The frontend is a Next.js app that allows users to upload a CSV file, which is then processed in the background using Trigger.dev tasks. The progress of the task is streamed back to the frontend in real-time using Trigger.dev Realtime.

- A [Next.js](https://nextjs.org/) app with [Trigger.dev](https://trigger.dev/) for the background tasks.
- [UploadThing](https://uploadthing.com/) to handle CSV file uploads
- Trigger.dev [Realtime](https://trigger.dev/launchweek/0/realtime) to stream updates to the frontend.

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `.env.example` file to `.env` and fill in the required environment variables. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
3. Copy the project ref from the Trigger.dev dashboard and and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with with `npm exec trigger dev` (it may ask you to authorize the CLI if you haven't already).

Now you should be able to visit `http://localhost:3000` and see the app running. Upload a CSV file and watch the progress bar update in real-time!

## Relevant code

- View the Trigger.dev task code in the [src/trigger/csv.ts](src/trigger/csv.ts) file.
- The parent task `csvValidator` downloads the CSV file, parses it, and then splits the rows into multiple batches. It then does a `batch.triggerAndWait` to distribute the work the `handleCSVRow` task.
- The `handleCSVRow` task "simulates" checking the row for a valid email address and then updates the progress of the parent task using `metadata.parent`. See the [Trigger.dev docs](https://trigger.dev/docs/runs/metadata#parent-and-root-updates) for more information on how to use the `metadata.parent` object.
- The `useRealtimeCSVValidator` hook in the [src/hooks/useRealtimeCSVValidator.ts](src/hooks/useRealtimeCSVValidator.ts) file handles the call to `useRealtimeRun` to get the progress of the parent task.
- The `CSVProcessor` component in the [src/components/CSVProcessor.tsx](src/components/CSVProcessor.tsx) file handles the file upload and displays the progress bar, and uses the `useRealtimeCSVValidator` hook to get the progress updates.

## Learn More

To learn more about Trigger.dev Realtime, take a look at the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features.
- [Metadata docs](https://trigger.dev/docs/runs/metadata) - learn about the Run Metadata feature of Trigger.dev.
- [Batch Trigger docs](https://trigger.dev/docs/triggering) - learn about the Batch Trigger feature of Trigger.dev.
- [Realtime docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev.
- [React hooks](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev.
