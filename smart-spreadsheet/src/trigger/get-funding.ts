import { task, metadata } from "@trigger.dev/sdk";
import Exa from "exa-js";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  amountRaised: z
    .string()
    .describe("Total funding raised, e.g. '$50M', '$1.2B', 'Bootstrapped', 'Unknown'"),
});

export const getFunding = task({
  id: "get-funding",
  retry: { maxAttempts: 2 },
  run: async ({ companyName }: { companyName: string }) => {
    const exa = new Exa(process.env.EXA_API_KEY!);

    const results = await exa.searchAndContents(
      `${companyName} company funding raised investment series`,
      {
        numResults: 5,
        text: { maxCharacters: 2000 },
        type: "auto",
      }
    );

    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Find the total funding raised by "${companyName}" from these search results:

${JSON.stringify(results.results, null, 2)}

Return the total amount raised (e.g., "$50M", "$1.2B"). If the company is bootstrapped, return "Bootstrapped". If you can't find funding info, return "Unknown".`,
      output: Output.object({ schema }),
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("amountRaised", output.amountRaised);

    return output;
  },
});
