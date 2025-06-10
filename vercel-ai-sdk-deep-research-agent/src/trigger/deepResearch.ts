import { openai } from "@ai-sdk/openai";
import { metadata, schemaTask } from "@trigger.dev/sdk";
import { generatePdfAndUpload } from "./generatePdfAndUpload";
import { generateObject, generateText, tool } from "ai";
import { generateReport } from "./generateReport";
import { Exa } from "exa-js";
import { z } from "zod";

export const mainModel = openai("gpt-4o");

type Learning = {
  learning: string;
  followUpQuestions: string[];
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

export const deepResearchOrchestrator = schemaTask({
  id: "deep-research",
  schema: z.object({
    prompt: z.string().min(1),
    // How many levels of queries to generate
    depth: z.number().min(1).max(5).optional().default(2),
    // How many queries to generate for each depth level
    breadth: z.number().min(1).max(10).optional().default(2),
  }),
  run: async (payload) => {
    metadata.set("status", {
      progress: 0,
      label: `Researching ${payload.prompt}. Depth: ${
        payload.depth ?? 2
      }. Breadth: ${payload.breadth ?? 3}`,
    });

    const research = await deepResearch(
      payload.prompt,
      payload.depth,
      payload.breadth,
      10, // Starting progress at 10%
    );

    metadata.set("status", {
      progress: 50,
      label: "Research complete. Generating report...",
    });

    const report = await generateReport.triggerAndWait({
      research: research,
    });

    metadata.set("status", {
      progress: 60,
      label: "Creating PDF and uploading to R2 storage...",
    });

    if (!report.ok) {
      throw new Error("No report generated");
    }

    const reportName = `research-report-${Date.now()}`;

    const pdf = await generatePdfAndUpload.triggerAndWait({
      report: report.output.report,
      name: reportName,
    });

    if (!pdf.ok) {
      throw new Error("No PDF generated");
    }

    metadata.set("status", {
      progress: 100,
      label: "Deep research complete!",
    });

    // Set the PDF name in metadata so the frontend can access it
    metadata.set("pdfName", pdf.output.key);

    return {
      report: report.output.report,
      pdf: pdf.output.pdfLocation,
    };
  },
});

export const deepResearch = async (
  prompt: string,
  depth: number,
  breadth: number,
  currentProgress: number = 10, // Starting progress
) => {
  if (!accumulatedResearch.query) {
    accumulatedResearch.query = prompt;
  }

  if (depth === 0) {
    return accumulatedResearch;
  }

  metadata.set("status", {
    progress: 25,
    label: `Generating ${breadth} search queries for: "${prompt}"...`,
  });

  const queries = await generateSearchQueries(prompt, breadth);
  accumulatedResearch.queries = queries;

  metadata.set("status", {
    progress: 25,
    label: `Depth ${depth}: Search queries: ${
      accumulatedResearch.queries.join(
        ", ",
      )
    }`,
  });

  for (const query of queries) {
    console.log(`Searching the web for: ${query}`);

    metadata.set("status", {
      progress: 25,
      label: `Searching the web for: "${query}"`,
    });

    const searchResults = await searchAndProcess(
      query,
      accumulatedResearch.searchResults,
    );
    accumulatedResearch.searchResults.push(...searchResults);

    for (const searchResult of searchResults) {
      console.log(`Processing search result: ${searchResult.url}`);

      metadata.set("status", {
        progress: 25,
        label: `Processing search result: "${searchResult.url}"`,
      });

      const learnings = await generateLearnings(query, searchResult);
      accumulatedResearch.learnings.push(learnings);
      accumulatedResearch.completedQueries.push(query);

      const newQuery = `Overall research goal: ${prompt}
        Previous search queries: ${
        accumulatedResearch.completedQueries.join(", ")
      }
 
        Follow-up questions: ${learnings.followUpQuestions.join(", ")}
        `;

      metadata.set("status", {
        progress: 25,
        label: `Generating learnings for ${newQuery}...`,
      });

      await deepResearch(
        newQuery,
        depth - 1,
        Math.ceil(breadth / 2),
        currentProgress,
      );
    }
  }
  return accumulatedResearch;
};

const generateSearchQueries = async (query: string, n: number = 3) => {
  try {
    const {
      object: { queries },
    } = await generateObject({
      model: mainModel,
      prompt: `Generate ${n} search queries for the following query: ${query}`,
      schema: z.object({
        queries: z.array(z.string()).min(1).max(5),
      }),
    });
    return queries;
  } catch (error) {
    console.error(`Error generating search queries for "${query}":`, error);
    // Return a fallback query
    return [query];
  }
};

const exa = new Exa(process.env.EXA_API_KEY);

type SearchResult = {
  title: string;
  url: string;
  content: string;
};

const searchWeb = async (query: string) => {
  const { results } = await exa.searchAndContents(query, {
    numResults: 1,
    livecrawl: "always",
  });
  return results.map(
    (r) =>
      ({
        title: r.title,
        url: r.url,
        content: r.text,
      }) as SearchResult,
  );
};

const searchAndProcess = async (
  query: string,
  searchResults: SearchResult[],
) => {
  const pendingSearchResults: SearchResult[] = [];
  const finalSearchResults: SearchResult[] = [];

  try {
    await generateText({
      model: mainModel,
      prompt: `Search the web for information about ${query}`,
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
            const results = await searchWeb(query);
            pendingSearchResults.push(...results);
            return results;
          },
        }),
        evaluate: tool({
          description: "Evaluate the search results",
          parameters: z.object({}),
          async execute() {
            const pendingResult = pendingSearchResults.pop()!;
            const { object: evaluation } = await generateObject({
              model: mainModel,
              prompt:
                `Evaluate whether the search results are relevant and will help answer the following query: ${query}. If the page already exists in the existing results, mark it as irrelevant.
 
            <search_results>
            ${JSON.stringify(pendingResult)}
            </search_results>
            `,
              output: "enum",
              enum: ["relevant", "irrelevant"],
            });
            if (evaluation === "relevant") {
              finalSearchResults.push(pendingResult);
            }
            console.log("Found:", pendingResult.url);
            metadata.set("status", {
              progress: 25,
              label: `Found relevant search result: "${pendingResult.url}"`,
            });

            console.log("Evaluation completed:", evaluation);

            metadata.set("status", {
              progress: 25,
              label: `Search result: "${pendingResult.url} is ${evaluation}"`,
            });

            return evaluation === "irrelevant"
              ? "Search results are irrelevant. Please search again with a more specific query."
              : "Search results are relevant. End research for this query.";
          },
        }),
      },
    });
  } catch (error) {
    console.error(`Error in searchAndProcess for query "${query}":`, error);
    // If we hit server errors, fall back to direct search
    const fallbackResults = await searchWeb(query);
    return fallbackResults.slice(0, 1); // Return at most 1 result as fallback
  }

  return finalSearchResults;
};

const generateLearnings = async (query: string, searchResult: SearchResult) => {
  try {
    const { object } = await generateObject({
      model: mainModel,
      prompt:
        `The user is researching "${query}". The following search result were deemed relevant.
      Generate a learning and a follow-up question from the following search result:
   
      <search_result>
      ${JSON.stringify(searchResult)}
      </search_result>
      `,
      schema: z.object({
        learning: z.string(),
        followUpQuestions: z.array(z.string()),
      }),
    });
    return object;
  } catch (error) {
    console.error(`Error generating learnings for query "${query}":`, error);
    // Return a basic fallback learning
    return {
      learning:
        `Found relevant information about "${query}" from ${searchResult.url}`,
      followUpQuestions: [`What are the key implications of ${query}?`],
    };
  }
};
