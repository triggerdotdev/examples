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
  run: async (payload: { prompt: string }) => {
    const depth: number = 2;
    const breadth: number = 3;

    if (!accumulatedResearch.query) {
      accumulatedResearch.query = payload.prompt;
    }

    if (depth === 0) {
      return accumulatedResearch;
    }

    // Use triggerAndWait to get the actual results
    const searchQueriesResult = await generateSearchQueries.triggerAndWait({
      prompt: payload.prompt,
      breadth: breadth,
    });

    if (!searchQueriesResult.ok) {
      throw new Error(
        `Failed to generate search queries: ${searchQueriesResult.error}`,
      );
    }

    const queries = searchQueriesResult.output.queries;
    accumulatedResearch.queries = queries;

    for (const query of queries) {
      console.log(`Searching the web for: ${query}`);
      const searchResult = await searchWeb.triggerAndWait({ query });

      if (!searchResult.ok) {
        console.error(`Failed to search for "${query}": ${searchResult.error}`);
        continue;
      }

      const searchResults = searchResult.output.results;

      accumulatedResearch.searchResults.push(...searchResults);

    for (const query of queries) {
    console.log(`Searching the web for: ${query}`)
    const searchResults = await searchAndProcess(query)
    accumulatedResearch.searchResults.push(...searchResults)
    for (const searchResult of searchResults) {
      console.log(`Processing search result: ${searchResult.url}`)
      const learnings = await generateLearnings(query, searchResult)
      accumulatedResearch.learnings.push(learnings)
      accumulatedResearch.completedQueries.push(query)
 
      const newQuery = `Overall research goal: ${prompt}
        Previous search queries: ${accumulatedResearch.completedQueries.join(', ')}
        Follow-up questions: ${learnings.followUpQuestions.join(', ')}
        `
      await deepResearch(newQuery, depth - 1, Math.ceil(breadth / 2)) 
    }
  }

    return accumulatedResearch;
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
  run: async (payload: { query: string, accumulatedSources: SearchResult[] }) => {
  const pendingSearchResults: SearchResult[] = []
  const finalSearchResults: SearchResult[] = []
  const { text } = await generateText({
    model: mainLLM,
    prompt: `Search the web for information about ${payload.query}`,
    system:
      'You are a researcher. For each query, search the web and then evaluate if the results are relevant and will help answer the following query',
    maxSteps: 5,
    tools: {
      searchWeb: tool({
        description: 'Search the web for information about a given query',
        parameters: z.object({
          query: z.string().min(1),
        }),
        async execute({ query }) {
          const results = await searchWeb.triggerAndWait({ query })
          if (!results.ok) {
            throw new Error(`Failed to search for "${query}": ${results.error}`)
          }
          pendingSearchResults.push(...results.output.results)
          return results.output.results
        },
      }),
      evaluate: tool({
        description: 'Evaluate the search results',
        parameters: z.object({}),
        async execute() {
          const pendingResult = pendingSearchResults.pop()!
          const { object: evaluation } = await generateObject({
            model: mainLLM,
            prompt: `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.
 
            <search_results>
            ${JSON.stringify(pendingResult)}
            </search_results>
 
            <existing_results>
            ${JSON.stringify(payload.accumulatedSources.map((result) => result.url))}
            </existing_results>
 
            `,
            output: 'enum',
            enum: ['relevant', 'irrelevant'],
          })
          if (evaluation === 'relevant') {
            finalSearchResults.push(pendingResult)
          }
          console.log('Found:', pendingResult.url)
          console.log('Evaluation completed:', evaluation)
          return evaluation === 'irrelevant'
            ? 'Search results are irrelevant. Please search again with a more specific query.'
            : 'Search results are relevant. End research for this query.'
        },
      }),
    },
  })
  return finalSearchResults
}
})