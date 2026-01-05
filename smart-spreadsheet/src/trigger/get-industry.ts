import { task } from "@trigger.dev/sdk";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const schema = z.object({
  industry: z
    .string()
    .describe(
      "Industry classification, e.g. 'Fintech / Payments', 'Enterprise SaaS', 'E-commerce'"
    ),
});

export const getIndustry = task({
  id: "get-industry",
  retry: { maxAttempts: 2 },
  run: async ({ companyName }: { companyName: string }) => {
    const { output } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `What industry does the company "${companyName}" operate in?

Provide a concise industry classification using common categories like:
- "Fintech / Payments"
- "Enterprise SaaS"
- "AI / Machine Learning"
- "E-commerce"
- "Developer Tools"
- "Healthcare Tech"
- "Cybersecurity"
- "Cloud Infrastructure"

If the company spans multiple industries, pick the primary one.`,
      output: Output.object({ schema }),
    });

    return output;
  },
});
