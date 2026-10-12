import { logger, task } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";
import { z } from "zod";
import { apify } from "./apify";
import { model } from "./model";

const LeadProfile = z.object({
  summary: z.string().describe("Two sentences on what the business does and who it serves"),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  socialProfiles: z.array(z.string()).describe("URLs of the business's social media profiles"),
});

export const enrichLead = task({
  id: "enrich-lead",
  retry: { maxAttempts: 3 },
  // Apify caps the memory of all your concurrent Actor runs (16 GB on the free plan), so only 2 crawls run at once
  queue: { concurrencyLimit: 2 },
  run: async (payload: { name: string; website: string }) => {
    // One page finishes in seconds, so the run waits for it instead of suspending on a webhook
    const run = await apify.actor("apify/website-content-crawler").call(
      {
        startUrls: [{ url: payload.website }],
        maxCrawlPages: 1,
        // The defaults keep only the main content and drop the header and footer, where contact details usually are
        htmlTransformer: "none",
        removeElementsCssSelector: "script, style, noscript, svg",
        proxyConfiguration: { useApifyProxy: true },
      },
      {
        timeout: 120, // Apify stops the Actor after 2 minutes, so it doesn't keep running after the task gives up
        waitSecs: 180,
        memory: 4096, // one page needs far less than the Actor's 8 GB default
        log: null,
      }
    );

    if (run.status !== "SUCCEEDED") {
      throw new Error(`Actor run ${run.id} finished with status ${run.status}`);
    }

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
    const page = items[0] as { markdown?: string; text?: string } | undefined;
    const markdown = page?.markdown ?? page?.text ?? "";
    // Keep the header and the footer of long pages, since that's where contact details are
    const content =
      markdown.length > 20_000 ? `${markdown.slice(0, 10_000)}\n…\n${markdown.slice(-10_000)}` : markdown;

    if (!content) {
      logger.warn("No readable content on the website", { website: payload.website });
      return { ...payload, profile: null };
    }

    const { output } = await generateText({
      model,
      output: Output.object({ schema: LeadProfile }),
      prompt:
        `Extract contact details and a short summary for the business "${payload.name}" ` +
        `from its website. Only include details that appear in the content.\n\n${content}`,
    });

    return { ...payload, profile: output };
  },
});
