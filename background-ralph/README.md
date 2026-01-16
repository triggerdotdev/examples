# background ralph

Autonomous coding agent that clones a GitHub repo, generates a PRD, and executes stories one at a time with human-in-the-loop approval gates.

## overview

Point Ralph at any GitHub repository with a natural language prompt. It explores the codebase, generates a PRD with stories, and executes each story autonomously using Claude. Between stories, you can review changes and decide whether to continue, stop, or approve the final result.

## tech stack

- [**next.js**](https://nextjs.org/) – frontend react framework (app router)
- [**claude agent sdk**](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) – autonomous coding agent
- [**trigger.dev**](https://trigger.dev/docs) – background task orchestration with realtime streams
- [**streamdown**](https://github.com/vercel/streamdown) – streaming markdown rendering
- [**tailwind css**](https://tailwindcss.com/) + [**shadcn/ui**](https://ui.shadcn.com/) – styling
- [**zod**](https://zod.dev/) – input validation

## setup & running locally

1. Clone the repo:
   ```bash
   git clone https://github.com/triggerdotdev/background-ralph.git
   cd background-ralph
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Fill in your `.env` file:

   | Variable | Description | Get it |
   |----------|-------------|--------|
   | `TRIGGER_PROJECT_REF` | Your Trigger.dev project reference | [trigger.dev/dashboard](https://cloud.trigger.dev) → Create project |
   | `TRIGGER_SECRET_KEY` | Your Trigger.dev secret key | Project settings → API keys |
   | `ANTHROPIC_API_KEY` | Claude API key | [console.anthropic.com](https://console.anthropic.com/) |
   | `GITHUB_TOKEN` | (Optional) GitHub PAT with repo scope | [github.com/settings/tokens](https://github.com/settings/tokens) |

   Without `GITHUB_TOKEN`, changes are ephemeral. With it, Ralph creates a branch and pushes commits.

5. Start both dev servers (in separate terminals):
   ```bash
   # Terminal 1: Next.js frontend
   pnpm dev

   # Terminal 2: Trigger.dev worker
   pnpm dev:trigger
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## how it works

The [`ralphLoop`](src/trigger/ralph-loop.ts) task orchestrates the entire workflow:

1. **Clone repo** – Clones the target GitHub repository to a temp directory
2. **Explore** – Shallow exploration (files, package.json, README) to understand the codebase
3. **Generate PRD** – Claude generates a PRD with 3-7 stories based on the prompt
4. **PRD review gate** – Waitpoint for human to edit/approve the PRD
5. **Story loop** – For each story:
   - Stream status to frontend via realtime streams
   - Run Claude agent with file tools (Read, Write, Edit, Bash)
   - Commit changes to branch
   - Approval gate (unless yolo mode)
6. **Push** – Push branch to GitHub and create PR

Realtime streams provide live updates:
- [`statusStream`](src/trigger/streams.ts) – Status updates, PRD, story progress
- [`agentOutputStream`](src/trigger/streams.ts) – Claude's output (streamed markdown)

## relevant code

| Capability | File |
|------------|------|
| Main orchestrator task | [`src/trigger/ralph-loop.ts`](src/trigger/ralph-loop.ts) |
| Realtime stream definitions | [`src/trigger/streams.ts`](src/trigger/streams.ts) |
| Run viewer with kanban board | [`src/components/run-viewer.tsx`](src/components/run-viewer.tsx) |
| Kanban board component | [`src/components/kanban-board.tsx`](src/components/kanban-board.tsx) |
| Streaming markdown output | [`src/components/agent-output.tsx`](src/components/agent-output.tsx) |
| Story editor modal | [`src/components/story-editor.tsx`](src/components/story-editor.tsx) |
| Server action to trigger run | [`src/app/actions.ts`](src/app/actions.ts) |
| Input validation schemas | [`src/lib/schemas.ts`](src/lib/schemas.ts) |

## learn more

- [**trigger.dev realtime streams**](https://trigger.dev/docs/realtime) – streaming data to frontend
- [**trigger.dev react hooks**](https://trigger.dev/docs/frontend/react-hooks) – `useRealtimeRun`, `useRealtimeStream`
- [**trigger.dev waitpoints**](https://trigger.dev/docs/wait) – human-in-the-loop patterns
- [**claude agent sdk**](https://github.com/anthropics/claude-agent-sdk) – autonomous coding agent
- [**streamdown**](https://streamdown.ai/) – streaming markdown component
