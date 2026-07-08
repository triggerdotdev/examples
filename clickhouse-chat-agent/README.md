# ClickHouse chat agent

A [Trigger.dev chat agent](https://trigger.dev/docs/ai-chat/overview) that answers questions about your data by writing and running SQL against [ClickHouse Cloud](https://clickhouse.com/cloud), using the official [ClickHouse Node.js client](https://clickhouse.com/docs/integrations/javascript).

The agent has three tools:

- **`listTables`** — lists tables with engine, row counts and size (from `system.tables`)
- **`describeTable`** — returns column names and types, using a bound `Identifier` query param (no SQL string interpolation)
- **`runQuery`** — runs read-only SQL: SELECT-style statements only, enforced in code plus `readonly=2`, a 1,000-row cap and a 30s timeout via ClickHouse settings. Query errors are returned to the model so it can fix its SQL and retry.

Trigger.dev handles the chat session, turn loop, streaming and resumability — the agent definition is a single `chat.agent()` call.

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref.

2. Configure the project ref:

   ```sh
   cp .env.example .env
   # paste your project ref into .env
   ```

3. In the dashboard, add two environment variables (Environment Variables page) for the Dev environment (and Prod if you deploy):

   - `CLICKHOUSE_URL` — your ClickHouse HTTPS endpoint with credentials embedded:
     `https://default:YOUR_PASSWORD@YOUR_SERVICE.clickhouse.cloud:8443`
   - `ANTHROPIC_API_KEY` — the agent uses Claude via the AI SDK

4. Install and run:

   ```sh
   npm install
   npx trigger.dev@latest dev
   ```

5. Open the **AI agents** page in the dashboard, select `clickhouse-agent`, and chat with it in the playground.

## Try asking

- "What data do I have?"
- "Describe the trips table"
- "What were the top 5 busiest pickup days? Show a table with trip counts and average fares."

If your database is empty, load one of the [ClickHouse example datasets](https://clickhouse.com/docs/getting-started/example-datasets) (e.g. NYC Taxi) from the ClickHouse Cloud SQL console first.

## Deploy

```sh
npx trigger.dev@latest deploy
```

Make sure `CLICKHOUSE_URL` and `ANTHROPIC_API_KEY` are set for the Prod environment in the dashboard.
