import { metadata, task } from "@trigger.dev/sdk/v3";
import { generateObject, generateText, tool } from "ai";
import z from "zod";
import { fastLLM, mainLLM, SearchResult } from "./deepResearch";
import { searchWeb } from "./searchWeb";

export const searchAndProcess = task({
  id: "search-and-process",
  run: async (
    payload: { query: string; accumulatedSources: SearchResult[] },
  ) => {
    metadata.root.set("status", {
      progress: 40,
      label: `Searching for ${payload.query}`,
    });

    const pendingSearchResults: SearchResult[] = [];
    const finalSearchResults: SearchResult[] = [];

    await generateText({
      model: mainLLM,
      prompt: `Search the web for information about ${payload.query}`,
      system:
        "You are a researcher. For each query, search the web and then evaluate if the results are relevant and will help answer the following query",
      maxSteps: 5,
      tools: {
        searchWeb: tool({
          description: "Search the web for information about a given query",
          parameters: z.object({
            query: z.string().min(1),
          }),
          async execute({ query }) {
            const results = await searchWeb.triggerAndWait({ query });
            if (!results.ok) {
              throw new Error(
                `Failed to search for "${query}": ${results.error}`,
              );
            }
            pendingSearchResults.push(...results.output.results);
            return results.output.results;
          },
        }),
        evaluate: tool({
          description: "Evaluate the search results",
          parameters: z.object({}),
          async execute() {
            const pendingResult = pendingSearchResults.pop();
            if (!pendingResult) {
              return "There are no search results to evaluate. Please use searchWeb first.";
            }
            const { object: evaluation } = await generateObject({
              model: fastLLM,
              prompt:
                `Evaluate whether the search results are relevant and will help answer the following query: ${payload.query}. If the page already exists in the existing results, mark it as irrelevant.
 
            <search_results>
            ${JSON.stringify(pendingResult)}
            </search_results>
 
            <existing_results>
            ${
                  JSON.stringify(
                    payload.accumulatedSources.map((result) => result.url),
                  )
                }
            </existing_results>
 
            `,
              output: "enum",
              enum: ["relevant", "irrelevant"],
            });
            if (evaluation === "relevant") {
              finalSearchResults.push(pendingResult);
            }

            console.log("Found:", pendingResult.url);
            console.log("Evaluation completed:", evaluation);

            if (evaluation === "relevant") {
              metadata.root.set("status", {
                progress: 45,
                label:
                  `Found relevant search results for ${pendingResult.title}`,
              });
            }

            return evaluation === "irrelevant"
              ? "Search results are irrelevant. Please search again with a more specific query."
              : "Search results are relevant. End research for this query.";
          },
        }),
      },
    });
    return finalSearchResults;
  },
});
