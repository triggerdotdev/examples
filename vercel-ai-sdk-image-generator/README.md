## Generate an image using Trigger.dev and the Vercel AI SDK

This demo is a full stack example that uses the following:

- A [Next.js](https://nextjs.org/) app using [shadcn](https://ui.shadcn.com/) for the UI
- Our 'useRealtimeRun' [React hook](https://trigger.dev/docs/frontend/react-hooks/realtime) to subscribe to the run and show updates on the frontend.
- The [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) to generate images using OpenAI's DALL-E models.

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `.env.example` file to `.env` and fill in the required environment variables. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
3. Copy the project ref from the Trigger.dev dashboard and and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with with `npx trigger dev` (it may ask you to authorize the CLI if you haven't already).

Now you should be able to visit `http://localhost:3000` and see the app running. Choose an image model, enter a prompt and click "Generate" to see the image generation in progress.

## Relevant code

- View the Trigger.dev task code which generates the image using the Vercel AI SDK in [src/trigger/realtime-generate-image.ts](src/trigger/realtime-generate-image.ts).
- We use a [useRealtimeRun](https://trigger.dev/docs/frontend/react-hooks/realtime#userealtimerun) hook to subscribe to the run in [src/app/processing/[id]/ProcessingContent.tsx](src/app/processing/[id]/ProcessingContent.tsx).

## Learn More

To learn more about Trigger.dev Realtime, take a look at the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features.
- [Batch Trigger docs](https://trigger.dev/docs/triggering) - learn about the Batch Trigger feature of Trigger.dev.
- [Realtime docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev.
- [React hooks](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev.
