# Lead research with Apify and Trigger.dev

A lead research desk for a sales team, built with [Trigger.dev](https://trigger.dev) and [Apify](https://apify.com) Actors:

- A **scheduled task** finds businesses on Google Maps for a search term and location.
- An **enrichment task** reads each business's website and extracts contact details and a summary.
- A **chat agent** answers questions the fixed pipeline doesn't cover, such as recent reviews, by finding and running an Apify Actor after you approve it.

Each part runs Apify Actors in a different way, because each has a different job:

| Pattern | Task | Use it when |
| --- | --- | --- |
| Start the Actor and suspend until its webhook arrives | `run-actor`, used by `discover-leads` | The Actor takes minutes to hours |
| Wait for the Actor inline | `enrich-lead` | The Actor finishes in seconds |
| Agent tools with approval | `research-agent` | The question decides which Actor runs |

## How it works

### Bulk discovery: suspend on a webhook

`discover-leads` (`src/trigger/discover-leads.ts`) is a [scheduled task](https://trigger.dev/docs/tasks/scheduled). It runs [Google Maps Scraper](https://apify.com/compass/crawler-google-places) through `run-actor` (`src/trigger/run-actor.ts`), which:

1. Creates a [wait token](https://trigger.dev/docs/wait-for-token).
2. Starts the Actor with an [ad-hoc webhook](https://docs.apify.com/platform/integrations/webhooks/ad-hoc-webhooks) that posts to the token's URL when the run ends, for all four terminal events: succeeded, failed, aborted and timed out.
3. Suspends on `wait.forToken()` until Apify calls back, then reads the dataset.

A suspended run uses no compute, so a two-hour scrape costs the same on the Trigger.dev side as a two-minute one. Nothing polls Apify while it works.

Nobody watches a scheduled job, so the Actor's spend is capped. Google Maps Scraper charges per place (pay-per-event), so the cap that applies is `maxTotalChargeUsd`. `discover-leads` also passes `maxItems`, which caps pay-per-result Actors. When a run reaches `maxTotalChargeUsd`, Apify aborts it, so `run-actor` returns the partial dataset of aborted and timed-out runs with their `status`, and only throws when the Actor fails. `run-actor` doesn't retry, because a retry would start a new paid Actor run.

### Enrichment: wait inline

`enrich-lead` (`src/trigger/enrich-lead.ts`) runs [Website Content Crawler](https://apify.com/apify/website-content-crawler) on one page with `call()`, which waits for the Actor to finish. Crawling one page takes seconds, so suspending would save almost nothing, and waiting inline keeps the code short. For the bulk scrape, the same approach would keep the run, and its compute bill, alive for the whole scrape.

The task then asks the model to extract emails, phone numbers, social profiles and a summary from the page.

### Agent: Apify Store tools with approval

`research-agent` (`src/trigger/research-agent.ts`) is a [`chat.agent`](https://trigger.dev/docs/ai-chat/overview) with three tools (`src/trigger/apify-tools.ts`):

- `searchApifyActors` searches [Apify Store](https://apify.com/store) for an Actor.
- `getApifyActorInputSchema` returns the Actor's input fields, so the model doesn't guess them.
- `runApifyActor` runs the Actor through `run-actor`. It has `needsApproval: true`, so every paid run waits for a person to approve it. The output is trimmed to about 50,000 characters, without empty fields, with the `datasetId` for the full dataset.

## Setup

1. Create a project in the [Trigger.dev dashboard](https://cloud.trigger.dev) and copy its project ref and a dev secret key (API keys page).
2. Get an [Apify API token](https://console.apify.com/settings/integrations?utm_source=trigger.dev&utm_medium=integrations) and an [OpenRouter API key](https://openrouter.ai/settings/keys).
3. Configure the environment:

   ```sh
   cp .env.example .env
   # fill in TRIGGER_PROJECT_REF, TRIGGER_SECRET_KEY, APIFY_TOKEN and OPENROUTER_API_KEY
   ```

   The model defaults to `anthropic/claude-sonnet-5.5`. Set `OPENROUTER_MODEL` to use another OpenRouter model with tool calling. Smaller models follow Actor input schemas less reliably, so expect more failed or denied runs before they get the input right.

4. Install and run both processes (two terminals):

   ```sh
   pnpm install
   pnpm dev:trigger   # the tasks and the agent
   pnpm dev           # the Next.js app
   ```

## Try it

### `discover-leads`

Scheduled tasks don't take a payload, so each schedule carries its search in the external ID, as `<search term> | <location>`. In the dashboard, open **Schedules**, create a schedule for `discover-leads`, and set the external ID, for example:

```
coffee roastery | Prague, Czechia
```

To run it once without waiting for the cron, open `discover-leads` on the **Tasks** page, press **Test schedule** and fill in the same **External ID**. The run returns the leads and triggers `enrich-lead` for the first five with a website. In the run trace, `run-actor` shows the time the Actor was working as a `wait.forToken()` span.

### `enrich-lead`

Test it from the dashboard with:

```json
{
  "name": "25 Coffee Roasters",
  "website": "https://25coffeeroasters.com/"
}
```

### `run-actor`

`discover-leads` and the agent call it, but you can also test it directly:

```json
{
  "actorId": "apify/website-content-crawler",
  "input": {
    "startUrls": [{ "url": "https://docs.apify.com/academy" }],
    "maxCrawlPages": 1,
    "proxyConfiguration": { "useApifyProxy": true }
  },
  "maxItems": 10
}
```

### `research-agent`

Open [http://localhost:3000](http://localhost:3000). The dashboard playground can't approve tool calls, so approval only works in this app. Ask, for example:

> Write a personalized opening line for a cold email to The Miners Coffee Roastery in Prague, based on their recent Google reviews.

The agent searches Apify Store, reads the Actor's input schema and asks before running it. Deny a run to see the agent try something else.

## Deploy

```sh
pnpm deploy:trigger
```

Set `APIFY_TOKEN`, `OPENROUTER_API_KEY` and, optionally, `OPENROUTER_MODEL` on the Environment Variables page for the Prod environment. Deploy the Next.js app anywhere with a prod `TRIGGER_SECRET_KEY`.

The app has no authentication: `mintChatAccessToken` issues a token for any chat ID, and every approved run spends your Apify and OpenRouter credit. Before you make it public, put it behind your own sign-in and limit how many agent runs can run at once, for example with a [queue](https://trigger.dev/docs/concurrency) on `research-agent`.

## Things to know

- **Cancelling a task doesn't stop its Actor run.** Abort it in [Apify Console](https://console.apify.com?utm_source=trigger.dev&utm_medium=integrations) or with `apify.run(runId).abort()`.
- **`enrich-lead` retries up to three times**, and each retry crawls the page again. A one-page crawl is cheap, so this keeps the code simple. `run-actor` doesn't retry at all, because its runs can be expensive.
- **`apify-client` is marked as external** in `trigger.config.ts`. Bundled, it fails with `TypeError: ProxyAgent is not a constructor`.
