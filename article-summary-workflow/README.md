# Article summary workflow with Trigger.dev and ReactFlow

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/migrating-from-v3).

Create audio summaries of newspaper articles!

https://github.com/user-attachments/assets/94f2346f-fdfe-4c6a-aca2-1fbd4a741569

This reference project shows a possible approach to implement workflows using [Trigger.dev](https://trigger.dev/) and [ReactFlow](https://reactflow.dev/).
It makes use of the Trigger.dev Realtime API and the new [waitpoint primitive](https://trigger.dev/blog/v4-beta-launch#waitpoints) to implement a human-in-the-loop approach for approving the result of an AI workflow.

At the time of writing, the waitpoint feature is available only in the [v4 beta release](https://trigger.dev/blog/v4-beta-launch#waitpoints).

## Getting started

1. After cloning the repo, run `pnpm install` to install the dependencies.
2. Create an `.env` file by copying [.env.example](.env.example) and fill in the required environment variables. The example file includes a description for each variable.
3. Create a new project using the Trigger.dev dashboard and copy the project ref.
4. Update the `project` field in the [trigger.config.ts](trigger.config.ts) file with the project ref.
5. Run the Next.js dev server with `pnpm run dev`.
6. In a separate terminal window, run the Trigger.dev dev CLI command with `pnpm exec trigger dev`. It will ask you to authenticate if you haven't already done so.

You should now be able to visit [http://localhost:3000](http://localhost:3000) and see the application running. Submit an article URL and and watch the workflow in action ✨.

## Walkthrough

Each node in the workflow corresponds to a Trigger.dev task. The idea is to enable building flows by composition of different tasks. The output of one task serves as input for another.

- **Trigger.dev task splitting**:
  - The [summarizeArticle](./src/trigger/summarizeArticle.ts) task uses the OpenAI API to generate a summary an article.
  - The [convertTextToSpeech](./src/trigger/convertTextToSpeech.ts) task uses the ElevenLabs API to convert the summary into an audio stream and upload it to an S3 bucket.
  - The [reviewSummary](./src/trigger/reviewSummary.ts) task is a human-in-the-loop step that shows the result and waits for approval of the summary before continuing.
  - [articleWorkflow](./src/trigger/articleWorkflow.ts) is the entrypoint that ties the workflow together and orchestrates the tasks. You might choose to approach the orchestration differently, depending on your use case.
- **ReactFlow Nodes**: there are three types of nodes in this example. All of them are custom ReactFlow nodes.
  - The [InputNode](./src/components/InputNode.tsx) is the starting node of the workflow. It triggers the workflow by submitting an article URL.
  - The [ActionNode](./src/components/ActionNode.tsx) is a node that shows the status of a task run in Trigger.dev, in real-time using the React hooks for Trigger.dev.
  - The [ReviewNode](./src/components/ReviewNode.tsx) is a node that shows the summary result and prompts the user for approval before continuing. It uses the Realtime API to fetch details about the review status. Also, it interacts with the Trigger.dev waitpoint API for completing the waitpoint token using Next.js server actions.
- **Workflow orchestration**:
  - The workflow is orchestrated by the [Flow](./src/components/Flow.tsx) component. It lays out the nodes, the connections between them, as well as the mapping to the Trigger.dev tasks.

While the workflow in this example is static and does not allow changing the connections between nodes in the UI, it serves as a good baseline for understanding how to build completely custom workflow builders using Trigger.dev and ReactFlow.

## Learn more

To learn more about the technologies used in this project, check out the following resources:

- [Trigger.dev Docs](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev Waitpoint Token Docs](https://trigger.dev/docs/wait-for-token) - learn about waitpoint tokens in Trigger.dev and human-in-the-loop flows
- [Trigger.dev Realtime Docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev
- [Trigger.dev Realtime Streams](https://trigger.dev/docs/realtime/streams) - learn about the different types of streams available in Trigger.dev
- [ReactFlow Docs](https://reactflow.dev/learn) - learn about building interactive diagrams using ReactFlow
- [React Hooks for Trigger.dev](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev
- [ElevenLabs SDK](https://elevenlabs.io/docs/overview) - learn about ElevenLabs' AI audio capabilities
- [AI SDK Docs](https://sdk.vercel.ai/docs/introduction) - learn about the AI SDK for working with LLMs
- [OpenAI API Docs](https://openai.com/api/) - learn about the OpenAI API
- [Slack Webhook API docs](https://api.slack.com/messaging/webhooks) - learn about sending messages to Slack using webhooks
