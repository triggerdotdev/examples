import { prompts } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { createProviderRegistry, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { catalogPromptSection, normalizeSpec, validateSpec } from "../lib/catalog";

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
    // Identifier params — the client binds them safely, no string interpolation.
    // A qualified name must bind as two identifiers; one param would escape
    // the whole string as a single (nonexistent) table name.
    const [database, name] = table.includes(".") ? table.split(".", 2) : [undefined, table];
    const result = await getClickHouse().query({
      query: database
        ? "DESCRIBE TABLE {database: Identifier}.{name: Identifier}"
        : "DESCRIBE TABLE {name: Identifier}",
      query_params: { database, name },
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

// The UI spec the model passes here is rendered in the Next.js app with
// json-render + shadcn components. Validation errors are returned to the
// model so it can fix the spec and retry.
const renderVisualization = tool({
  description:
    "Render charts, tables and stat cards for the user, instead of describing data as text. " +
    "Pass a json-render spec built from the components listed in the system prompt, with the " +
    "data rows inlined. Use whenever an answer contains tabular data, a trend, a comparison " +
    "or a headline number.",
  inputSchema: z.object({
    spec: z.object({
      root: z.string().describe("Key of the root element"),
      elements: z.record(
        z.string(),
        z.object({
          type: z.string().describe("A component name from the system prompt"),
          props: z.record(z.string(), z.unknown()),
          children: z.array(z.string()).optional().describe("Keys of child elements"),
        })
      ),
    }),
  }),
  execute: async ({ spec }) => {
    const normalized = normalizeSpec(spec);
    if (!normalized) {
      return { ok: false, errors: ['spec must be an object of the form { root: "<key>", elements: { ... } }'] };
    }
    const result = validateSpec(normalized);
    if (!result.ok) {
      // Surfaces in the run log — handy when tuning the catalog or prompt.
      console.warn("renderVisualization spec rejected:", result.errors);
      return { ok: false, errors: result.errors };
    }
    return {
      ok: true,
      note: "Rendered to the user. Don't repeat the data as text — add at most a one-sentence takeaway.",
    };
  },
});

const tools = { listTables, describeTable, runQuery, renderVisualization };

// ============================================================================
// The chat agent
// ============================================================================

const registry = createProviderRegistry({ anthropic });

// A versioned AI Prompt: edit or override the analyst guidance (and model/
// temperature) from the dashboard without redeploying. The json-render
// component reference is generated from the catalog at run time and injected
// as a template variable, so it always matches the deployed code.
const systemPrompt = prompts.define({
  id: "clickhouse-analyst",
  description: "System prompt for the ClickHouse data-analyst chat agent",
  model: "anthropic:claude-opus-4-8",
  variables: z.object({
    componentReference: z.string(),
  }),
  content: `You are a ClickHouse data analyst. You answer questions about the data in the connected ClickHouse database by running SQL queries.

Guidelines:
- If you don't know what data exists yet, call listTables first, then describeTable before querying a table.
- Write ClickHouse SQL (not Postgres/MySQL dialect). Prefer aggregations over fetching raw rows.
- Always LIMIT raw-row queries to 100 rows or fewer.
- If a query fails, read the error, fix the SQL, and retry.

Presenting results:
- Whenever the answer contains tabular data, a trend, a comparison or a headline number, call renderVisualization instead of writing the data out as text: LineChart/AreaChart for time series, BarChart for rankings and comparisons, PieChart for share-of-total, Table for detail rows, a Grid of Stats for KPIs, PointMap for geographic questions when the data has coordinates (aggregate to at most ~200 points in SQL, e.g. round coordinates and count).
- Compose visualizations inside a Card with a title; put multiple related views in one spec (e.g. a Stat row above a chart).
- Keep chart data to a reasonable number of points (aggregate in SQL first) and pre-format display values (round numbers, currency symbols) in the props.
- After rendering, add at most a one-or-two-sentence takeaway in text. Never repeat the rendered data as a markdown table.

## renderVisualization spec reference

{{componentReference}}`,
});

export const clickhouseAgent = chat.agent({
  id: "clickhouse-agent",
  idleTimeoutInSeconds: 300,

  // Declared on the config so tool results survive history re-conversion
  // across turns; the resolved set comes back typed on the run payload.
  tools,

  onChatStart: async () => {
    // Resolves the latest prompt version (or an active dashboard override)
    // and stores it for the run. chat.toStreamTextOptions() picks up the
    // system text, model, config AND experimental_telemetry from it — the
    // telemetry is what links model-call spans to the prompt and makes LLM
    // observability (tokens, cost, latency) show up in the dashboard.
    const resolved = await systemPrompt.resolve({
      componentReference: catalogPromptSection(),
    });
    chat.prompt.set(resolved);
  },

  run: async ({ messages, tools, signal }) => {
    return streamText({
      // Fallback model only — placed BEFORE the spread so the stored
      // prompt's model (including dashboard overrides) wins when set.
      model: anthropic("claude-opus-4-8"),
      // Spread chat.toStreamTextOptions() — it wires up prepareStep
      // (compaction, steering, background injection), plus the system
      // prompt + model + config + telemetry from chat.prompt().
      // Skipping this is the single most common cause of subtle bugs
      // (silent broken compaction, missing LLM observability, etc.).
      ...chat.toStreamTextOptions({ registry }),
      messages,
      tools,
      stopWhen: stepCountIs(15),
      abortSignal: signal,
    });
  },
});
