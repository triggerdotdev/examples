import { schemaTask } from "@trigger.dev/sdk/v3";
import { generateObject } from "ai";
import z from "zod";
import { fastLLM } from "./deepResearch";

export const generateSearchQueries = schemaTask({
  id: "generate-search-queries",
  schema: z.object({
    prompt: z.string(),
    breadth: z.number(),
  }),
  run: async (payload) => {
    const { object: { queries } } = await generateObject({
      model: fastLLM,
      prompt:
        `Generate ${payload.breadth} search queries for the following query: ${payload.prompt}`,
      schema: z.object({
        queries: z.array(z.string()).min(1).max(5),
      }),
    });

    return {
      queries,
    };
  },
});
