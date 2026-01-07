import { task, metadata } from "@trigger.dev/sdk";
import Exa from "exa-js";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const employeeRanges = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1,000",
  "1,001-5,000",
  "5,001-10,000",
  "10,001+",
] as const;

const schema = z.object({
  employeeCount: z
    .enum(employeeRanges)
    .describe("Employee count range - pick the closest match"),
});

export const getEmployeeCount = task({
  id: "get-employee-count",
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
      `${companyName} company employees headcount team size`,
      {
        numResults: 3,
        text: { maxCharacters: 1500 },
        type: "auto",
      }
    );

    // Get the best source URL
    const sourceUrl = results.results[0]?.url ?? null;

    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Estimate the employee count for "${companyName}" based on these search results:

${JSON.stringify(results.results, null, 2)}

Pick the closest range from: ${employeeRanges.join(", ")}

If you find a specific number, pick the range it falls into. If no data, estimate based on company size/stage.`,
      output: Output.object({ schema }),
    });

    // Update parent metadata for realtime streaming
    metadata.parent.set("employeeCount", output.employeeCount);

    return {
      employeeCount: output.employeeCount,
      sourceUrl,
    };
  },
});
