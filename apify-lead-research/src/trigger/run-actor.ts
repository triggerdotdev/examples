import { logger, task, wait } from "@trigger.dev/sdk";
import { apify } from "./apify";

// Shape produced by the payloadTemplate below, not Apify's default webhook payload
type ApifyWebhookPayload = {
  eventType: string;
  resource: { id: string; status: string; defaultDatasetId: string };
};

export type RunActorPayload = {
  actorId: string;
  input: Record<string, unknown>;
  maxItems?: number;
  maxTotalChargeUsd?: number;
};

export const runActor = task({
  id: "run-actor",
  // A retry would start, and pay for, a new Actor run, so failures go back to the caller instead
  retry: { maxAttempts: 1 },
  run: async ({ actorId, input, maxItems = 1000, maxTotalChargeUsd = 1 }: RunActorPayload) => {
    const token = await wait.createToken({ timeout: "1h" });

    const run = await apify.actor(actorId).start(input, {
      timeout: 3000, // 50 minutes, shorter than the token timeout
      maxItems, // caps spend on pay-per-result Actors
      maxTotalChargeUsd, // caps spend on pay-per-event Actors
      webhooks: [
        {
          eventTypes: [
            "ACTOR.RUN.SUCCEEDED",
            "ACTOR.RUN.FAILED",
            "ACTOR.RUN.ABORTED",
            "ACTOR.RUN.TIMED_OUT",
          ],
          requestUrl: token.url,
          payloadTemplate: `{ "eventType": {{eventType}}, "resource": {{resource}} }`,
        },
      ],
    });

    logger.info("Actor run started, waiting for webhook", { actorId, runId: run.id });

    // The run suspends here and uses no compute until Apify calls token.url
    const result = await wait.forToken<ApifyWebhookPayload>(token).unwrap();

    if (result.eventType === "ACTOR.RUN.FAILED") {
      throw new Error(`Actor run ${result.resource.id} failed`);
    }

    // Aborted and timed-out runs keep what they scraped. Apify also aborts a run when it
    // reaches maxTotalChargeUsd, and those results are already paid for
    const { items } = await apify
      .dataset(result.resource.defaultDatasetId)
      .listItems({ limit: maxItems });

    const status = result.resource.status;
    if (status !== "SUCCEEDED") {
      logger.warn("Actor run stopped early, returning partial results", { status });
    }

    logger.info("Actor run finished", { runId: result.resource.id, status, itemCount: items.length });

    return { runId: result.resource.id, status, datasetId: result.resource.defaultDatasetId, items };
  },
});
