import { schemaTask } from "@trigger.dev/sdk/v3";
import { SearchResult } from "./deepResearch";
import z from "zod";

export const searchWeb = schemaTask({
  id: "search-web",
  schema: z.object({
    query: z.string().min(1),
  }),
  run: async (payload) => {
    // Use Exa for web search
    const Exa = (await import("exa-js")).default;
    const exa = new Exa(process.env.EXA_API_KEY);

    const { results } = await exa.searchAndContents(payload.query, {
      numResults: 3,
      livecrawl: "always",
    });

    return {
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.text?.slice(0, 2000) || "", // Limit to 2000 chars (~500 tokens)
      })) as SearchResult[],
    };
  },
});
