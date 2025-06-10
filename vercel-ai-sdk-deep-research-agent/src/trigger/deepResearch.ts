import { openai } from "@ai-sdk/openai";
import { metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { generatePdfAndUpload } from "./generatePdfAndUpload";
import { generateObject, generateText, tool } from "ai";
import { generateReport } from "./generateReport";
import { Exa } from "exa-js";
import { z } from "zod";

export const mainModel = openai("gpt-4o-mini");
export const fastModel = openai("gpt-4o-mini");

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

// add an orchestrator task for deepresearch then generate report

export const deepResearchOrchestrator = schemaTask({
  id: "deep-research",
  schema: z.object({
    prompt: z.string().min(1),
    // How many levels of queries to generate
    depth: z.number().min(1).max(5).optional(),
    // How many queries to generate for each depth level
    breadth: z.number().min(1).max(10).optional(),
  }),
  run: async (payload) => {
    metadata.set("status", {
      progress: 0,
      label: "Starting research...",
    });

    metadata.set("status", {
      progress: 0,
      label: "Starting research...",
    });

    const research = await deepResearch(
      payload.prompt,
      payload.depth ?? 2,
      payload.breadth ?? 3,
    );

    metadata.set("status", {
      progress: 50,
      label: "Research complete. Generating report...",
    });

    const report = await generateReport.triggerAndWait({ research });

    metadata.set("status", {
      progress: 60,
      label: "Creating PDF and uploading to R2 storage...",
    });

    if (!report.ok) {
      throw new Error("No report generated");
    }

    const reportName = `research-report-${Date.now()}.pdf`;

    const pdf = await generatePdfAndUpload.triggerAndWait({
      report: report.output.report,
      name: reportName,
    });

    if (!pdf.ok) {
      throw new Error("No PDF generated");
    }

    return {
      report: report.output.report,
      pdf: pdf.output.pdfLocation,
    };
  },
});

const deepResearch = async (
  prompt: string,
  depth: number,
  breadth: number,
) => {
  if (!accumulatedResearch.query) {
    accumulatedResearch.query = prompt;
  }

  if (depth === 0) {
    return accumulatedResearch;
  }

  const queries = await generateSearchQueries(prompt, breadth);
  accumulatedResearch.queries = queries;

  for (const query of queries) {
    console.log(`Searching the web for: ${query}`);
    const searchResults = await searchAndProcess(
      query,
      accumulatedResearch.searchResults,
    );
    accumulatedResearch.searchResults.push(...searchResults);

    for (const searchResult of searchResults) {
      console.log(`Processing search result: ${searchResult.url}`);
      const learnings = await generateLearnings(query, searchResult);
      accumulatedResearch.learnings.push(learnings);
      accumulatedResearch.completedQueries.push(query);

      const newQuery = `Overall research goal: ${prompt}
        Previous search queries: ${
        accumulatedResearch.completedQueries.join(", ")
      }
 
        Follow-up questions: ${learnings.followUpQuestions.join(", ")}
        `;
      await deepResearch(newQuery, depth - 1, Math.ceil(breadth / 2));
    }
  }
  return accumulatedResearch;
};

const generateSearchQueries = async (query: string, n: number = 3) => {
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
          console.log("Evaluation completed:", evaluation);
          return evaluation === "irrelevant"
            ? "Search results are irrelevant. Please search again with a more specific query."
            : "Search results are relevant. End research for this query.";
        },
      }),
    },
  });
  return finalSearchResults;
};

const generateLearnings = async (query: string, searchResult: SearchResult) => {
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
};
