import { task, metadata } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  website: z.string().describe("Official company website URL"),
  description: z.string().describe("Brief company description, 1-2 sentences"),
});

export const getBasicInfo = task({
  id: "get-basic-info",
  retry: { maxAttempts: 2 },
  run: async ({ companyName }: { companyName: string }) => {
    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `What is the official website URL and a brief description for the company "${companyName}"?

Return the most likely official website (prefer .com domains) and a concise 1-2 sentence description of what the company does.

If you're not confident about the website, return your best guess with the company name as a domain (e.g., "https://companyname.com").`,
      output: Output.object({ schema }),
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("website", output.website);
    metadata.parent.set("description", output.description);

    return output;
  },
});
