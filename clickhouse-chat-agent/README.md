# ClickHouse chat agent — charts, not walls of text

A [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that answers questions about your data by writing and running SQL against [ClickHouse Cloud](https://clickhouse.com/cloud) — and presents the results as **interactive charts, tables and stat cards** instead of paragraphs of text.

The agent decides when a visualization beats prose: it calls a `renderVisualization` tool with a [json-render](https://json-render.dev) spec, and the Next.js chat UI renders it live with [shadcn/ui](https://ui.shadcn.com) components and [shadcn charts](https://ui.shadcn.com/charts) (Recharts).

## How it works

**The agent** (`src/trigger/clickhouse-agent.ts`) is a single `chat.agent()` call — Trigger.dev handles the chat session, turn loop, streaming and resumability. Its system prompt is a versioned [AI Prompt](https://trigger.dev/docs/ai/prompts) (`prompts.define()` + `chat.prompt.set()`), so you can edit the analyst guidance, model or temperature from the dashboard without redeploying — and every model call is traced in the run with token, cost and latency metrics linked to the prompt version. It has four tools:

- **`listTables`** — lists tables with engine, row counts and size (from `system.tables`)
- **`describeTable`** — returns column names and types, using a bound `Identifier` query param (no SQL string interpolation)
- **`runQuery`** — runs read-only SQL: SELECT-style statements only, enforced in code plus `readonly=2`, a 1,000-row cap and a 30s timeout. Query errors are returned to the model so it can fix its SQL and retry.
- **`renderVisualization`** — takes a json-render UI spec (charts, tables, stat cards, composed in cards and grids) with the query results inlined. The spec is validated against the component catalog; validation errors go back to the model so it can correct the spec and retry.

**The shared catalog** (`src/lib/catalog.ts`) defines which components the model may use — `Table`, `Card`, `Grid`, `Badge`, etc. from [`@json-render/shadcn`](https://www.npmjs.com/package/@json-render/shadcn), plus custom `BarChart`, `LineChart`, `AreaChart`, `PieChart` and `Stat` components, and a `PointMap` built on [mapcn](https://mapcn.dev) (MapLibre GL with free CARTO basemap tiles — no API key) for geographic answers. The same catalog generates the system-prompt component reference and validates tool calls, so the prompt and the renderer can't drift apart.

**The frontend** (`src/app`, `src/components`) is a Next.js app using [`useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) with [`useTriggerChatTransport`](https://trigger.dev/docs/ai-chat/frontend) — the browser talks directly to Trigger.dev's durable streams, no API route needed. `renderVisualization` tool parts in the message stream are rendered with json-render's `<Renderer>` and the shadcn component registry (`src/lib/registry.tsx`).

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref and a dev secret key (API keys page).

2. Configure the environment:

   ```sh
   cp .env.example .env
   # paste your project ref and secret key into .env
   ```

3. In the dashboard, add two environment variables (Environment Variables page) for the Dev environment (and Prod if you deploy):

   - `CLICKHOUSE_URL` — your ClickHouse HTTPS endpoint with credentials embedded:
     `https://default:YOUR_PASSWORD@YOUR_SERVICE.clickhouse.cloud:8443`
   - `ANTHROPIC_API_KEY` — the agent uses Claude via the AI SDK

4. Install and run both processes (two terminals):

   ```sh
   pnpm install
   pnpm dev:trigger   # the agent
   pnpm dev           # the Next.js app
   ```

5. Open [http://localhost:3000](http://localhost:3000) and chat with your data.

## Try asking

- "What data do I have?"
- "Show the top 5 busiest pickup days as a bar chart"
- "How do trip counts and average fares trend by month?"
- "Break down trips by payment type"
- "Show the top 100 pickup locations on a map, sized by trip count"

If your database is empty, load one of the [ClickHouse example datasets](https://clickhouse.com/docs/getting-started/example-datasets) (e.g. NYC Taxi) from the ClickHouse Cloud SQL console first.

## Deploy

```sh
pnpm deploy:trigger
```

Make sure `CLICKHOUSE_URL` and `ANTHROPIC_API_KEY` are set for the Prod environment in the dashboard, and deploy the Next.js app anywhere with `TRIGGER_SECRET_KEY` (prod) set.
