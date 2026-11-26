import { tool } from "ai";
import { z } from "zod";
import { apify } from "./apify";
import { runActor } from "./run-actor";

// Roughly 12k tokens. Larger datasets stay in Apify and the model gets the datasetId
const MAX_OUTPUT_CHARS = 50_000;

const isEmpty = (value: unknown) =>
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" && value !== null && Object.keys(value).length === 0);

// Scrapers return many empty fields, and dropping them fits more items into the budget
function compact(item: unknown) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return item;
  return Object.fromEntries(Object.entries(item).filter(([, value]) => !isEmpty(value)));
}

export const searchApifyActors = tool({
  description:
    "Search Apify Store for a pre-built scraper (Actor) that can extract data " +
    "from a specific website or platform. Use this before running an Actor when you " +
    "don't already know which one to use.",
  inputSchema: z.object({
    query: z.string().describe('What to scrape, e.g. "google maps reviews"'),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  execute: async ({ query, limit }) => {
    const { items } = await apify.store().list({ search: query, limit });

    return items.map((actor) => ({
      actorId: `${actor.username}/${actor.name}`,
      title: actor.title,
      description: actor.description,
      monthlyUsers: actor.stats?.totalUsers30Days,
      pricing: actor.currentPricingInfo?.pricingModel,
    }));
  },
});

type ActorInputSchema = {
  required?: string[];
  properties?: Record<
    string,
    {
      type?: string;
      title?: string;
      description?: string;
      default?: unknown;
      prefill?: unknown;
      enum?: unknown[];
    }
  >;
};

export const getApifyActorInputSchema = tool({
  description:
    "Get the input fields an Apify Actor accepts. Call this before runApifyActor " +
    "so the input matches the Actor's schema.",
  inputSchema: z.object({
    actorId: z.string().describe('Actor ID, e.g. "compass/crawler-google-places"'),
  }),
  execute: async ({ actorId }) => {
    const build = await (await apify.actor(actorId).defaultBuild()).get();
    const schema = build?.actorDefinition?.input as ActorInputSchema | undefined;

    // Full schemas can be tens of kilobytes; descriptions are cut to keep the context small
    const properties = Object.fromEntries(
      Object.entries(schema?.properties ?? {}).map(([name, field]) => [
        name,
        {
          type: field.type,
          description: (field.description ?? field.title)?.slice(0, 200),
          default: field.default,
          prefill: field.prefill,
          enum: field.enum,
        },
      ])
    );

    return { required: schema?.required ?? [], properties };
  },
});

async function runAndTrim(actorId: string, input: Record<string, unknown>) {
  const result = await runActor.triggerAndWait({ actorId, input, maxItems: 100 });

  if (!result.ok) {
    return { error: `Actor run failed: ${result.error}` };
  }

  const items: unknown[] = [];
  let size = 0;
  for (const item of result.output.items.map(compact)) {
    size += JSON.stringify(item).length;
    if (size > MAX_OUTPUT_CHARS) break;
    items.push(item);
  }

  const itemCount = result.output.items.length;
  const { datasetId, status } = result.output;
  const outcome =
    status === "SUCCEEDED" ? "succeeded" : `stopped early (${status}), with partial results,`;

  return {
    // Spelled out, because with only a "truncated" flag the test model started another run to get more items
    note:
      items.length < itemCount
        ? `The run ${outcome} with ${itemCount} items. Showing the first ${items.length} to fit the context; the rest are in Apify dataset ${datasetId}.`
        : `The run ${outcome} with ${itemCount} items, all shown.`,
    itemCount,
    datasetId,
    items,
  };
}

// The AI SDK runs approved tool calls in parallel, but a task can only wait on one subtask at a time
let runQueue: Promise<unknown> = Promise.resolve();

export const runApifyActor = tool({
  description:
    "Run an Apify Actor to scrape structured data from the web. Apify executes on " +
    "its own infrastructure and IP pool. Returns the scraped dataset, trimmed to fit " +
    "the context window.",
  inputSchema: z.object({
    actorId: z.string().describe('Actor ID, e.g. "compass/crawler-google-places"'),
    input: z.record(z.string(), z.unknown()).describe("Actor input object, per its input schema"),
  }),
  needsApproval: true, // scrapes cost money, so a person confirms each run
  execute: ({ actorId, input }) => {
    const run = runQueue.then(() => runAndTrim(actorId, input));
    runQueue = run.catch(() => {});
    return run;
  },
});
