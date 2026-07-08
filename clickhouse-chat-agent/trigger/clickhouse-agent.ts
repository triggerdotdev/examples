import { chat } from "@trigger.dev/sdk/ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

// ============================================================================
// ClickHouse client (Node.js client, HTTPS interface)
// ============================================================================

// Lazy singleton so the env var is read at run time, where the dashboard's
// environment variables have been injected.
let clickhouse: ClickHouseClient | undefined;

function getClickHouse(): ClickHouseClient {
  if (!clickhouse) {
    const url = process.env.CLICKHOUSE_URL;
    if (!url) {
      throw new Error(
        "CLICKHOUSE_URL is not set. Add it in the Trigger.dev dashboard under Environment Variables, e.g. https://default:password@your-service.clickhouse.cloud:8443"
      );
    }
    clickhouse = createClient({ url });
  }
  return clickhouse;
}

// Keep tool outputs a sane size for the model and the chat stream.
const MAX_OUTPUT_CHARS = 50_000;

function capOutput(rows: unknown[]): { rows: unknown[]; truncated: boolean } {
  let out = rows;
  while (out.length > 1 && JSON.stringify(out).length > MAX_OUTPUT_CHARS) {
    out = out.slice(0, Math.ceil(out.length / 2));
  }
  return { rows: out, truncated: out.length < rows.length };
}

// ============================================================================
// Tools
// ============================================================================

const listTables = tool({
  description:
    "List the tables in the ClickHouse database, with their engine and row counts. Use this first to see what data is available.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await getClickHouse().query({
      query: `
        SELECT database, name, engine, total_rows, formatReadableSize(total_bytes) AS size
        FROM system.tables
        WHERE database NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')
        ORDER BY database, name
      `,
      format: "JSONEachRow",
    });
    return { tables: await result.json() };
  },
});

const describeTable = tool({
  description:
    "Get the schema (column names and types) of a table. Use this before writing a query against a table.",
  inputSchema: z.object({
    table: z
      .string()
      .describe("The table name, optionally qualified with a database, e.g. 'default.trips'"),
  }),
  execute: async ({ table }) => {
    // Identifier param — the client binds it safely, no string interpolation.
    const result = await getClickHouse().query({
      query: "DESCRIBE TABLE {table: Identifier}",
      query_params: { table },
      format: "JSONEachRow",
    });
    return { columns: await result.json() };
  },
});

const READ_ONLY_STATEMENTS = /^\s*(select|with|show|describe|desc|explain|exists)\b/i;

const runQuery = tool({
  description:
    "Run a read-only SQL query against ClickHouse and get the results as JSON rows. " +
    "Only SELECT-style statements are allowed. Always include a LIMIT (at most 100 rows) " +
    "unless the query is an aggregation.",
  inputSchema: z.object({
    query: z.string().describe("The ClickHouse SQL query to run"),
  }),
  execute: async ({ query }) => {
    if (!READ_ONLY_STATEMENTS.test(query)) {
      return {
        error:
          "Only read-only statements (SELECT, WITH, SHOW, DESCRIBE, EXPLAIN, EXISTS) are allowed.",
      };
    }

    try {
      const result = await getClickHouse().query({
        query,
        format: "JSONEachRow",
        clickhouse_settings: {
          // readonly=2: reads only (no writes/DDL), but per-query settings like
          // the limits below are still allowed.
          readonly: "2",
          max_result_rows: "1000",
          result_overflow_mode: "break",
          max_execution_time: 30,
        },
      });

      const rows = await result.json();
      const capped = capOutput(rows);
      return {
        rowCount: rows.length,
        rows: capped.rows,
        ...(capped.truncated ? { note: "Result truncated — refine the query or aggregate." } : {}),
      };
    } catch (error) {
      // Return ClickHouse errors to the model so it can fix the query and retry.
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});

const tools = { listTables, describeTable, runQuery };

// ============================================================================
// The chat agent
// ============================================================================

const SYSTEM_PROMPT = `You are a ClickHouse data analyst. You answer questions about the data in the connected ClickHouse database by running SQL queries.

Guidelines:
- If you don't know what data exists yet, call listTables first, then describeTable before querying a table.
- Write ClickHouse SQL (not Postgres/MySQL dialect). Prefer aggregations over fetching raw rows.
- Always LIMIT raw-row queries to 100 rows or fewer.
- If a query fails, read the error, fix the SQL, and retry.
- Present results as concise markdown — use tables for tabular data and call out the key takeaway in a sentence.`;

export const clickhouseAgent = chat.agent({
  id: "clickhouse-agent",
  idleTimeoutInSeconds: 300,

  // Declared on the config so tool results survive history re-conversion
  // across turns; the resolved set comes back typed on the run payload.
  tools,

  run: async ({ messages, tools, signal }) => {
    return streamText({
      // Spread chat.toStreamTextOptions() FIRST — it wires up
      // prepareStep (compaction, steering, background injection),
      // the system prompt set via chat.prompt(), and telemetry.
      // Skipping this is the single most common cause of subtle
      // bugs (silent broken compaction, missing steering, etc.).
      ...chat.toStreamTextOptions(),
      model: anthropic("claude-opus-4-8"),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: signal,
    });
  },
});
