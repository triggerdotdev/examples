# GitHub repository analyzer with Claude Agent SDK

AI-powered repository analyzer that lets you ask questions about any public GitHub repository. Uses Anthropic's Claude Agent SDK with agentic tools to explore codebases and provide detailed answers, with real-time streaming responses to the frontend via Trigger.dev.

## Tech Stack

- [**Next.js**](https://nextjs.org/) – React framework with App Router
- [**Claude Agent SDK**](https://platform.claude.com/docs/en/agent-sdk/overview) – Anthropic's SDK for building AI agents; provides an agentic loop with shell, file, and search tools
- [**Trigger.dev**](https://trigger.dev/) – runs the agent in a long-running background task with real-time streaming to the frontend

## Features

- **Ask anything about any public repo** – Architecture, security vulnerabilities, API endpoints, testing strategies, etc.
- **Claude Agent SDK exploration** – Claude explores the codebase and provide detailed answers
- **Cancel anytime** – Abort long-running Trigger.dev task with cleanup
- **Trigger.dev Realtime streaming** – Watch Claude's analysis stream in as it's generated
- **Progress tracking using Trigger.dev Realtime** – See clone status, analysis progress, and repo size

## Setup & Running Locally

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd claude-agent-github-wiki
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Copy environment variables and configure**

   ```bash
   cp .env.example .env
   ```

   Fill in the required variables:

   - `TRIGGER_SECRET_KEY` – Get from [Trigger.dev dashboard](https://cloud.trigger.dev/)
   - `TRIGGER_PROJECT_REF` – Your Trigger.dev project ref (starts with `proj_`)
   - `ANTHROPIC_API_KEY` – Get from [Anthropic Console](https://console.anthropic.com/)

4. **Start development servers**

   ```bash
   # Terminal 1: Start Next.js dev server
   npm run dev

   # Terminal 2: Start Trigger.dev CLI
   npx trigger.dev@latest dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## How It Works

Trigger.dev orchestrates the repository analysis through a single long-running task:

1. **`analyzeRepo`** – Main task that:
   - Clones the repository to a temp directory (shallow clone for speed)
   - Spawns a Claude agent with file system tools
   - Streams Claude's response in real-time via Trigger.dev Realtime Streams
   - Cleans up temp directory on completion or error

**Process flow:**

```
User enters GitHub URL + question
    ↓
API triggers analyzeRepo task
    ↓
Clone repo to temp directory
    ↓
Claude Agent SDK explores codebase with tools
    ↓
Response streams via Trigger.dev Realtime → Frontend
    ↓
Cleanup temp directory
```

**Claude's available tools:**

- **Bash** – Run shell commands to explore the repo
- **Glob** – Find files by pattern (e.g., `**/*.ts`)
- **Grep** – Search file contents with regex
- **Read** – Read file contents

## Relevant Code

- **Main analysis task** – Clones repo, runs Claude agent, streams response ([`trigger/analyze-repo.ts`](trigger/analyze-repo.ts))
- **Stream definition** – Typed stream for real-time text responses ([`trigger/agent-stream.ts`](trigger/agent-stream.ts))
- **API endpoint** – Triggers the task and returns access token ([`app/api/analyze-repo/route.ts`](app/api/analyze-repo/route.ts))
- **Response page** – Real-time streaming display with progress ([`app/response/[runId]/page.tsx`](app/response/[runId]/page.tsx))
- **Landing page** – Repository URL input with example repos ([`app/page.tsx`](app/page.tsx))
- **Trigger.dev config** – Project settings with external SDK bundle ([`trigger.config.ts`](trigger.config.ts))

## Learn More

- [**Trigger.dev Realtime Streams**](https://trigger.dev/docs/realtime/streams) – Stream data from tasks to your frontend
- [**Trigger.dev React Hooks**](https://trigger.dev/docs/realtime/react-hooks/overview) – `useRealtimeStream` for consuming streams
- [**Claude Agent SDK**](https://github.com/anthropic-ai/claude-agent-sdk) – Run Claude with agentic tool usage
- [**Trigger.dev schemaTask**](https://trigger.dev/docs/tasks/schematask) – Type-safe task payloads with Zod
