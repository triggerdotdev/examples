# Changelog Generator using Claude Agent SDK and Trigger.dev

Generate intelligent changelogs from GitHub commits using AI with a two-phase approach: scan commits first, then selectively fetch diffs for unclear changes.

## Tech Stack

- **Next.js** – Frontend framework using App Router
- **Claude Agent SDK** – Anthropic's SDK for building AI agents with custom tools
- **Trigger.dev** – Background task orchestration with real-time streaming
- **Octokit** – GitHub API client

## Features

- **Two-phase intelligent analysis**:
  1. Claude first lists all commits in the date range
  2. For unclear commits ("fix bug", "update"), Claude requests the actual diff
  3. Generates grouped changelog with full context
- **Custom MCP tools** – Claude can call `list_commits` and `get_commit_diff` on demand
- **Private repo support** – Optional GitHub token for private repositories
- **Real-time streaming** – Watch the changelog generate live

## How It Works

```
User enters repo URL + date range
    ↓
API triggers generate-changelog task
    ↓
Claude Agent SDK with custom GitHub tools:
  - list_commits: fetches commit messages via GitHub API
  - get_commit_diff: fetches diff for specific commit SHA
    ↓
Claude explores commits, requests diffs as needed
    ↓
Generates grouped changelog
    ↓
Streams to frontend via Trigger.dev Realtime
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in:
   - `TRIGGER_SECRET_KEY` – From [Trigger.dev dashboard](https://cloud.trigger.dev/)
   - `TRIGGER_PROJECT_REF` – Your project ref (starts with `proj_`)
   - `ANTHROPIC_API_KEY` – From [Anthropic Console](https://console.anthropic.com/)
   - `GITHUB_TOKEN` (optional) – For private repos, needs `repo` scope

3. **Start development servers**

   ```bash
   # Terminal 1: Next.js
   npm run dev

   # Terminal 2: Trigger.dev CLI
   npx trigger.dev@latest dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Relevant Files

- `trigger/generate-changelog.ts` – Main task with custom MCP tools for GitHub
- `trigger/changelog-stream.ts` – Stream definition for real-time output
- `app/api/generate-changelog/route.ts` – API endpoint
- `app/response/[runId]/page.tsx` – Streaming display page

## Custom Tools

The task defines two custom MCP tools that Claude can use:

```typescript
// List commits with messages (lightweight)
list_commits({ since: "2024-01-01", until: "2024-02-01" })

// Get full diff for a specific commit (on-demand)
get_commit_diff({ sha: "abc1234" })
```

This two-phase approach minimizes token usage while giving Claude full context when needed.
