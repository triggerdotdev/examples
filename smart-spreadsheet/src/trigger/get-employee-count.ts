import { task, metadata } from "@trigger.dev/sdk";
import Exa from "exa-js";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  employeeCount: z
    .string()
    .describe("Employee count range, e.g. '50-100', '1,000-5,000', '10,000+'"),
});

export const getEmployeeCount = task({
  id: "get-employee-count",
  retry: { maxAttempts: 2 },
  run: async ({ companyName }: { companyName: string }) => {
    const exa = new Exa(process.env.EXA_API_KEY!);

    const results = await exa.searchAndContents(
      `${companyName} company employees headcount team size`,
      {
        numResults: 3,
        text: { maxCharacters: 1500 },
        type: "auto",
      }
    );

    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Estimate the employee count for "${companyName}" based on these search results:

${JSON.stringify(results.results, null, 2)}

Provide a range estimate (e.g., "50-100", "500-1,000", "5,000-10,000", "10,000+"). If you can't find specific numbers, make an educated estimate based on the company's apparent size and industry.`,
      output: Output.object({ schema }),
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("employeeCount", output.employeeCount);

    return output;
  },
});
