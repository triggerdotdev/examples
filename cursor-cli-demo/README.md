# Cursor background agent using the Cursor CLI and Trigger.dev

Learn how to run Cursor's headless CLI agent inside a Trigger.dev task, parsing NDJSON stdout into a Realtime Stream that renders live in a browser terminal.

## Tech stack

- **[Next.js](https://nextjs.org)** – App Router frontend with server actions to trigger runs
- **[Cursor CLI](https://cursor.com)** – Headless AI coding agent spawned as a child process
- **[Trigger.dev](https://trigger.dev)** – Background task orchestration with real-time streaming to the frontend, observability, and deployment

## Running the project locally

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables**

   ```bash
   cp env.local.example .env.local
   ```

   - `TRIGGER_SECRET_KEY` – From [Trigger.dev dashboard](https://cloud.trigger.dev/) (starts with `tr_dev_` or `tr_`)
   - `TRIGGER_PROJECT_REF` – Your project ref (starts with `proj_`)
   - `CURSOR_API_KEY` – Your Cursor API key for headless CLI access

3. **Start development servers**

   ```bash
   # Terminal 1: Next.js
   pnpm dev

   # Terminal 2: Trigger.dev
   npx trigger.dev@latest dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the demo

## Features

- **Build extensions** – Installs `cursor-agent` into the task container image via `addLayer`, so any system binary can ship with your task
- **Realtime Streams v2** – NDJSON from a child process stdout is parsed and piped directly to the browser using `streams.define()` and `.pipe()`
- **Live terminal rendering** – Each cursor event (system, assistant, tool_call, result) renders as a distinct row with auto-scroll
- **Long-running tasks** – cursor-agent runs for minutes; Trigger.dev handles lifecycle, timeouts, and retries
- **Machine selection** – `medium-2x` preset for resource-intensive CLI tools
- **Model picker** – Switch between Claude models from the UI before triggering a run
- **Container binary workaround** – Demonstrates the `/tmp` copy + `chmod` pattern needed when the runtime strips execute permissions

## Relevant files

- [extensions/cursor-cli.ts](extensions/cursor-cli.ts) – Build extension + spawn helper that returns a typed NDJSON stream and `waitUntilExit()`
- [trigger/cursor-agent.ts](trigger/cursor-agent.ts) – The task: spawns the CLI, pipes the stream, waits for exit
- [trigger/cursor-stream.ts](trigger/cursor-stream.ts) – Realtime Streams v2 stream definition
- [components/terminal.tsx](components/terminal.tsx) – Realtime terminal UI with `useRealtimeRunWithStreams`
- [lib/cursor-events.ts](lib/cursor-events.ts) – TypeScript types and parsers for cursor NDJSON events
- [trigger.config.ts](trigger.config.ts) – Trigger.dev config with the cursor CLI build extension
