## Trigger.dev full-stack batch trigger demo

https://github.com/user-attachments/assets/daaf620b-a18b-4de1-bc37-766fa00854e2

This demo is a full stack example that uses the following:

- A [Next.js](https://nextjs.org/) app with [Prisma](https://www.prisma.io/) for the database.
- Trigger.dev [Realtime](https://trigger.dev/launchweek/0/realtime) to stream updates to the frontend.
- Work with multiple LLM models using the [AI SDK](https://sdk.vercel.ai/docs/introduction)
- Distribute tasks across multiple tasks using the new [`batch.triggerByTaskAndWait`](https://trigger.dev/docs/triggering#batch-triggerbytaskandwait) method.

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `.env.example` file to `.env` and fill in the required environment variables. If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project.
3. Run `npx prisma migrate dev` to create the database and generate the Prisma client.
4. Copy the project ref from the Trigger.dev dashboard and and add it to the `trigger.config.ts` file.
5. Run the Next.js server with `npm run dev`.
6. In a separate terminal, run the Trigger.dev dev CLI command with with `npx trigger dev` (it may ask you to authorize the CLI if you haven't already).

Now you should be able to visit `http://localhost:3000` and see the app running. Enter a prompt and click "Evaluate" to see the LLM-generated responses.

## Relevant code

- View the Trigger.dev task code in the [src/trigger/ai.ts](src/trigger/batch.ts) file.
- The `evaluateModels` task uses the `batch.triggerByTaskAndWait` method to distribute the task to the different LLM models.
- It then passes the results through to a `summarizeEvals` task that calculates some dummy "tags" for each LLM response.
- We use a [useRealtimeRunsWithTag](https://trigger.dev/docs/frontend/react-hooks/realtime#userealtimerunswithtag) hook to subscribe to the different evaluation tasks runs in the [src/components/llm-evaluator.tsx](src/components/llm-evaluator.tsx) file.
- We then pass the relevant run down into three different components for the different models:
  - The `AnthropicEval` component: [src/components/evals/Anthropic.tsx](src/components/evals/Anthropic.tsx)
  - The `XAIEval` component: [src/components/evals/XAI.tsx](src/components/evals/XAI.tsx)
  - The `OpenAIEval` component: [src/components/evals/OpenAI.tsx](src/components/evals/OpenAI.tsx)
- Each of these components then uses [useRealtimeRunWithStreams](https://trigger.dev/docs/frontend/react-hooks/realtime#userealtimerunwithstreams) to subscribe to the different LLM responses.

## Learn More

To learn more about Trigger.dev Realtime, take a look at the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features.
- [Batch Trigger docs](https://trigger.dev/docs/triggering) - learn about the Batch Trigger feature of Trigger.dev.
- [Realtime docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev.
- [React hooks](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev.
