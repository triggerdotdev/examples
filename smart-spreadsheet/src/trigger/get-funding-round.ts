import { metadata, task } from "@trigger.dev/sdk";
import Exa from "exa-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const fundingStages = [
  "Pre-seed",
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Series E",
  "Series F+",
  "Public",
  "Bootstrapped",
  "Unknown",
] as const;

const schema = z.object({
  stage: z
    .enum(fundingStages)
    .describe("Current funding stage of the company"),
  lastRoundAmount: z
    .string()
    .describe("Amount raised in last round, e.g. '$15M', '$100M', 'N/A'"),
});

export const getFundingRound = task({
  id: "get-funding-round",
  retry: { maxAttempts: 2 },
  run: async ({
    companyName,
    companyUrl,
  }: {
    companyName: string;
    companyUrl?: string | null;
  }) => {
    const exa = new Exa(process.env.EXA_API_KEY!);

    const results = await exa.searchAndContents(
      `${companyName} latest funding round series raised`,
      {
        numResults: 5,
        text: { maxCharacters: 2000 },
        type: "auto",
      },
    );

    // Get the best source URL
    const sourceUrl = results.results[0]?.url ?? null;

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt:
        `Find the latest funding round for "${companyName}" from these search results:

${JSON.stringify(results.results, null, 2)}

Extract:
1. Stage: Pick from ${fundingStages.join(", ")}
2. Last round amount: The amount raised in their most recent round (e.g., "$15M", "$100M")

If bootstrapped with no funding, use stage "Bootstrapped" and amount "N/A".
If you can't find funding info, use stage "Unknown" and amount "N/A".`,
      schema,
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("stage", object.stage);
    metadata.parent.set("lastRoundAmount", object.lastRoundAmount);

    return {
      stage: object.stage,
      lastRoundAmount: object.lastRoundAmount,
      sourceUrl,
    };
  },
});
