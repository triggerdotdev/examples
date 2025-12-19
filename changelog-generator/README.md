# Changelog generator using theClaude Agent SDK and Trigger.dev

An AI agent that explores GitHub commits, investigates unclear changes by fetching diffs on demand, and generates developer-friendly changelogs. Built with the Claude Agent SDK and Trigger.dev.

## Tech Stack

- **[Next.js](https://nextjs.org)** – Frontend framework using App Router
- **[Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)** – Anthropic's agent SDK for building AI agents with custom tools
- **[Trigger.dev](https://trigger.dev)** – Background task orchestration with real-time streaming to the frontend, observability, and deployment.
- **[Octokit](https://github.com/octokit/octokit.js)** – GitHub API client for fetching commits and diffs.

## Demo

<video src="https://content.trigger.dev/claude-changelog-generator.mp4" controls autoplay loop muted width="100%"></video>

## Running the project locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   - `TRIGGER_SECRET_KEY` – From [Trigger.dev dashboard](https://cloud.trigger.dev/)
   - `TRIGGER_PROJECT_REF` – Your project ref (starts with `proj_`)
   - `ANTHROPIC_API_KEY` – From [Anthropic Console](https://console.anthropic.com/)
   - `GITHUB_TOKEN` (optional) – For private repos, needs `repo` scope

3. **Start development servers**

   ```bash
   # Terminal 1: Next.js
   npm run dev

   # Terminal 2: Trigger.dev
   npx trigger.dev@latest dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the demo

## Features

- **Two-phase analysis** – Lists all commits first, then selectively fetches diffs only for ambiguous ones to minimize token usage
- **Custom MCP tools** – `list_commits` and `get_commit_diff` called autonomously by Claude
- **Real-time streaming** – Changelog streams to the frontend as it's generated via Trigger.dev Realtime
- **Live observability** – Agent phase, turn count, and tool calls broadcast via run metadata
- **Markdown rendering** – Streamed output formatted with [Streamdown](https://github.com/vercel/streamdown) and Shiki syntax highlighting
- **Private repo support** – Optional GitHub token for private repositories

## Relevant Files

- [trigger/generate-changelog.ts](trigger/generate-changelog.ts) – Main task with MCP tools
- [trigger/changelog-stream.ts](trigger/changelog-stream.ts) – Stream definition
- [app/api/generate-changelog/route.ts](app/api/generate-changelog/route.ts) – API endpoint
- [app/response/[runId]/page.tsx](app/response/[runId]/page.tsx) – Streaming display page
