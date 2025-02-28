## Claude Chatbot with Trigger.dev Streaming

This project is a full-stack chat application that uses the following:

- A [Next.js](https://nextjs.org/) app for the chat interface
- [Trigger.dev](https://trigger.dev) Realtime to stream AI responses and thinking/reasoning process to the frontend
- [Claude 3.7 Sonnet](https://www.anthropic.com/claude) for generating AI responses
- [AI SDK](https://sdk.vercel.ai/docs/introduction) for working with the Claude model

## Getting started

1. After cloning the repo, run `npm install` to install the dependencies.
2. Copy the `.env.example` file to `.env` and fill in the required environment variables:
   - You'll need an Anthropic API key for Claude. Create a free account at [Anthropic](https://console.anthropic.com/signup) to get your API key.
   - If you haven't already, sign up for a free Trigger.dev account [here](https://cloud.trigger.dev/login) and create a new project
3. Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.
4. Run the Next.js server with `npm run dev`.
5. In a separate terminal, run the Trigger.dev dev CLI command with `npx trigger dev` (it may ask you to authorize the CLI if you haven't already).

Now you should be able to visit `http://localhost:3000` and see the chat application running. Enter a message and click "Send" to start chatting with Claude.

## Relevant code

- **Claude Stream Task**: View the Trigger.dev task code in the [src/trigger/claude-stream.ts](src/trigger/claude-stream.ts) file, which sets up the streaming connection with Claude.
- **Chat Component**: The main chat interface is in [app/components/claude-chat.tsx](app/components/claude-chat.tsx), which handles:
  - Message state management
  - User input handling
  - Rendering of message bubbles
  - Integration with Trigger.dev for streaming
- **Stream Response**: The `StreamResponse` component within the chat component handles:
  - Displaying streaming text from Claude
  - Showing/hiding the thinking process with an animated toggle
  - Auto-scrolling as new content arrives

## Key Technical Features

- **Real-time Streaming**: Uses `useRealtimeRunWithStreams` to subscribe to Claude's responses as they're generated.
- **Thinking Process**: Leverages Claude's "thinking" capability to show the AI's reasoning process.

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Trigger.dev Documentation](https://trigger.dev/docs) - learn about Trigger.dev and its features
- [Trigger.dev Realtime docs](https://trigger.dev/docs/realtime) - learn about the Realtime feature of Trigger.dev
- [Trigger.dev Realtime streams](https://trigger.dev/docs/realtime/streams) - learn about the different types of streams available in Trigger.dev
- [React hooks for Trigger.dev](https://trigger.dev/docs/frontend/react-hooks) - learn about the React hooks provided by Trigger.dev
- [Anthropic Claude Documentation](https://docs.anthropic.com/) - learn about Claude's capabilities and API
- [AI SDK Documentation](https://sdk.vercel.ai/docs/introduction) - learn about the AI SDK for working with LLMs
