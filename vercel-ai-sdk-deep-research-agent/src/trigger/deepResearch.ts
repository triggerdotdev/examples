import { openai } from "@ai-sdk/openai";
import { schemaTask, task } from "@trigger.dev/sdk/v3";
import {
  experimental_generateImage as generateImage,
  generateObject,
  generateText,
  tool,
} from "ai";
import { z } from "zod";

const mainLLM = openai("gpt-4o");

type Learning = {
  learning: string;
  followUpQuestions: string[];
};

type SearchResult = {
  title: string;
  url: string;
  content: string;
};

type Research = {
  query: string | undefined;
  queries: string[];
  searchResults: SearchResult[];
  learnings: Learning[];
  completedQueries: string[];
};

const accumulatedResearch: Research = {
  query: undefined,
  queries: [],
  searchResults: [],
  learnings: [],
  completedQueries: [],
};

export const deepResearch = task({
  id: "deep-research",
  run: async (
    payload: { prompt: string; maxDepth?: number; maxBreadth?: number },
  ) => {
    const maxDepth = payload.maxDepth || 2;
    const maxBreadth = payload.maxBreadth || 3;

    const research: Research = {
      query: payload.prompt,
      queries: [],
      searchResults: [],
      learnings: [],
      completedQueries: [],
    };

    let currentQueries = [payload.prompt];

    // Iterative approach instead of recursion
    for (let depth = 0; depth < maxDepth; depth++) {
      const nextLevelQueries: string[] = [];

      for (const query of currentQueries) {
        console.log(`Depth ${depth}: Searching for: ${query}`);

        // Search and process
        const searchResults = await searchAndProcess.triggerAndWait({
          query,
          accumulatedSources: research.searchResults,
        });

        if (!searchResults.ok) {
          console.error(
            `Failed to search for "${query}": ${searchResults.error}`,
          );
          continue;
        }

        research.searchResults.push(...searchResults.output);

        // Generate learnings and follow-up questions
        for (const searchResult of searchResults.output) {
          console.log(`Processing search result: ${searchResult.url}`);

          const learnings = await generateLearnings.triggerAndWait({
            query,
            searchResult,
          });

          if (!learnings.ok) {
            console.error(`Failed to generate learnings: ${learnings.error}`);
            continue;
          }

          research.learnings.push(learnings.output);
          research.completedQueries.push(query);

          // Add follow-up questions for next depth level
          nextLevelQueries.push(
            ...learnings.output.followUpQuestions.slice(
              0,
              Math.ceil(maxBreadth / (depth + 1)),
            ),
          );
        }
      }

      // Prepare queries for next depth level
      currentQueries = nextLevelQueries.slice(0, maxBreadth);

      // Stop if no more queries to explore
      if (currentQueries.length === 0) {
        break;
      }
    }

    const report = await generateReport.triggerAndWait({ research });

    if (!report.ok) {
      throw new Error(`Failed to generate report: ${report.error}`);
    }

    return report.output.report;
  },
});

export const generateSearchQueries = schemaTask({
  id: "generate-search-queries",
  schema: z.object({
    prompt: z.string(),
    breadth: z.number(),
  }),
  run: async (payload) => {
    const { object: { queries } } = await generateObject({
      model: mainLLM,
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

export const searchWeb = task({
  id: "search-web",
  run: async (payload: { query: string }) => {
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
        content: r.text,
      })) as SearchResult[],
    };
  },
});

export const searchAndProcess = task({
  id: "search-and-process",
  run: async (
    payload: { query: string; accumulatedSources: SearchResult[] },
  ) => {
    const pendingSearchResults: SearchResult[] = [];
    const finalSearchResults: SearchResult[] = [];
    const { text } = await generateText({
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
            const pendingResult = pendingSearchResults.pop()!;
            const { object: evaluation } = await generateObject({
              model: mainLLM,
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

export const generateLearnings = task({
  id: "generate-learnings",
  run: async (payload: { query: string; searchResult: SearchResult }) => {
    const { object } = await generateObject({
      model: mainLLM,
      prompt:
        `The user is researching "${payload.query}". The following search result were deemed relevant.
    Generate a learning and a follow-up question from the following search result:
 
    <search_result>
    ${JSON.stringify(payload.searchResult)}
    </search_result>
    `,
      schema: z.object({
        learning: z.string(),
        followUpQuestions: z.array(z.string()),
      }),
    });
    return object;
  },
});

const SYSTEM_PROMPT = `You are an expert researcher. Today is ${
  new Date().toISOString()
}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.
  - Use Markdown formatting.`;

export const generateReport = task({
  id: "generate-report",
  run: async (payload: { research: Research }) => {
    const { text } = await generateText({
      model: mainLLM,
      prompt: "Generate a report based on the following research data:\n\n" +
        JSON.stringify(payload.research, null, 2),
      system: SYSTEM_PROMPT,
    });
    return {
      report: text,
    };
  },
});
