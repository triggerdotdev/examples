import { task, metadata } from "@trigger.dev/sdk";
import Exa from "exa-js";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  website: z.string().describe("Official company website URL"),
  description: z
    .string()
    .describe("Very short company tagline, max 10-15 words"),
});

export const getBasicInfo = task({
  id: "get-basic-info",
  retry: { maxAttempts: 2 },
  run: async ({
    companyName,
    companyUrl,
  }: {
    companyName: string;
    companyUrl?: string | null;
  }) => {
    const exa = new Exa(process.env.EXA_API_KEY!);

    // If we have a URL, search more specifically using the domain
    const searchQuery = companyUrl
      ? `site:${new URL(companyUrl).hostname} about`
      : `${companyName} official website company`;

    // Search for the company's official website
    const results = await exa.searchAndContents(searchQuery, {
      numResults: 3,
      text: { maxCharacters: 2000 },
      type: "auto",
    });

    // Get the best source URL (prefer company domains over news/wiki)
    const sourceUrl = results.results[0]?.url ?? null;

    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Extract the official website URL and a brief description for "${companyName}" from these search results:

${JSON.stringify(results.results, null, 2)}

Instructions:
1. Website: ${companyUrl ? `The user provided "${companyUrl}" - verify this is correct or find the official company website URL.` : "Find the official company website URL (not LinkedIn, Wikipedia, or news articles). Look for the company's own domain."}
2. Description: Write a VERY short tagline (10-15 words max). Example: "Cloud infrastructure for deploying and scaling applications globally."

If you can't find the official website in the results, ${companyUrl ? `use "${companyUrl}".` : "make your best guess based on the company name (e.g., \"https://companyname.com\")."}`,
      output: Output.object({ schema }),
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("website", output.website);
    metadata.parent.set("description", output.description);

    return {
      website: output.website,
      description: output.description,
      sourceUrl,
    };
  },
});
