import { metadata, schemaTask, task, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, tool } from "ai";
import { generatePdfAndUpload } from "./generatePdfAndUpload";

const mainLLM = openai("gpt-4o");
const fastLLM = openai("gpt-4o-mini");

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
  query: string;
  queries: string[];
  searchResults: SearchResult[];
  learnings: Learning[];
};

export const deepResearch = schemaTask({
  id: "deep-research",
  schema: z.object({
    prompt: z.string().min(1),
    maxDepth: z.number().min(1).max(5).optional(),
    maxBreadth: z.number().min(1).max(10).optional(),
  }),
  run: async (payload) => {
    // const maxDepth = payload.maxDepth || 2;
    // const maxBreadth = payload.maxBreadth || 3;

    // const research: Research = {
    //   query: payload.prompt,
    //   queries: [],
    //   searchResults: [],
    //   learnings: [],
    // };

    // const searchQueriesResult = await generateSearchQueries.triggerAndWait({
    //   prompt: payload.prompt,
    //   breadth: maxBreadth,
    // });

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 10,
      label: "Generating search queries",
    });

    // if (!searchQueriesResult.ok) {
    //   throw new Error(
    //     `Failed to generate search queries: ${searchQueriesResult.error}`,
    //   );
    // }

    // let currentQueries = searchQueriesResult.output.queries;
    // research.queries = currentQueries;

    // // Iterative approach instead of recursion
    // for (let depth = 0; depth < maxDepth; depth++) {
    //   // Stop if no more queries to explore
    //   if (currentQueries.length === 0) {
    //     break;
    //   }

    //   const nextLevelQueries: string[] = [];

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 20,
      label: "Generating search results",
    });

    // // Parallelize search processing for all queries at this depth level
    // console.log(
    //   `Depth ${depth}: Processing ${currentQueries.length} queries in parallel`,
    // );

    // const searchBatch = await searchAndProcess.batchTriggerAndWait(
    //   currentQueries.map((query) => ({
    //     payload: { query, accumulatedSources: research.searchResults },
    //   })),
    // );

    // // Process all search results
    // metadata.set("progress", {
    //   progress: 40,
    //   label: "Generating search results",
    // });

    // for (let i = 0; i < searchBatch.runs.length; i++) {
    //   const searchResult = searchBatch.runs[i];
    //   const originalQuery = currentQueries[i];

    //   if (!searchResult.ok) {
    //     console.error(
    //       `Failed to search for "${originalQuery}": ${searchResult.error}`,
    //     );
    //     continue;
    //   }

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 50,
      label: "Generating learnings from search results",
    });

    // research.searchResults.push(...searchResult.output);

    // // Only batch trigger if we have results
    // if (searchResult.output.length > 0) {
    //   // Parallelize learning generation for all search results from this query
    //   const learningBatch = await generateLearnings.batchTriggerAndWait(
    //     searchResult.output.map((result) => ({
    //       payload: {
    //         query: originalQuery,
    //         searchResult: result,
    //       },
    //     })),
    //   );

    //   // Collect learnings and follow-up questions
    //   for (const learning of learningBatch.runs) {
    //     if (!learning.ok) {
    //       console.error(`Failed to generate learnings: ${learning.error}`);
    //       continue;
    //     }

    //     research.learnings.push(learning.output);

    //     // Add follow-up questions for next depth level
    //     nextLevelQueries.push(
    //       ...learning.output.followUpQuestions.slice(
    //         0,
    //         Math.ceil(maxBreadth / (depth + 1)),
    //       ),
    //     );

    // metadata.set("progress", {
    //   progress: 60,
    //   label: "Generating report",
    // });
    // }
    // }
    // }

    //   // Prepare queries for next depth level
    //   currentQueries = nextLevelQueries.slice(0, maxBreadth);
    // }

    // const report = await generateReport.triggerAndWait({ research });

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 70,
      label: "Generating report",
    });

    // if (!report.ok) {
    //   throw new Error(`Failed to generate report: ${report.error}`);
    // }

    // // Generate and upload PDF
    // const pdfResult = await generatePdfAndUpload.triggerAndWait({
    //   report: report.output.report,
    //   title: payload.prompt,
    // });

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 80,
      label: "Generating PDF",
    });

    // if (!pdfResult.ok) {
    //   console.error(`PDF generation failed: ${pdfResult.error}`);
    //   return report.output.report; // Return just the HTML if PDF fails
    // }

    await wait.for({ seconds: 5 });
    metadata.set("status", {
      progress: 90,
      label: "Uploading PDF to R2",
    });

    await wait.for({ seconds: 5 });

    metadata.set("status", {
      progress: 100,
      label: "Completed",
    });

    return {
      // report: report.output.report,
      //     pdfLocation: pdfResult.output.pdfLocation,
      //   };
    };
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

export const searchAndProcess = task({
  id: "search-and-process",
  run: async (
    payload: { query: string; accumulatedSources: SearchResult[] },
  ) => {
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

export const generateLearnings = schemaTask({
  id: "generate-learnings",
  schema: z.object({
    query: z.string().min(1),
    searchResult: z.object({
      title: z.string(),
      url: z.string().url(),
      content: z.string(),
    }),
  }),
  run: async (payload) => {
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
  - Generate your response in clean HTML format with proper headings, paragraphs, lists, and formatting.
  - Use semantic HTML tags like <h1>, <h2>, <p>, <ul>, <ol>, <blockquote>, <strong>, <em>.`;

export const generateReport = task({
  id: "generate-report",
  run: async (payload: { research: Research }) => {
    // Create a more efficient summary instead of full JSON dump
    const summary = {
      query: payload.research.query,
      totalSources: payload.research.searchResults.length,
      keyFindings: payload.research.learnings.map((l) => l.learning).slice(
        0,
        10,
      ), // Limit to top 10
      topSources: payload.research.searchResults.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
      })), // Just title/URL, not full content
    };

    const { text } = await generateText({
      model: mainLLM,
      prompt: `Research Query: "${summary.query}"
      
Key Findings:
${summary.keyFindings.map((finding, i) => `${i + 1}. ${finding}`).join("\n")}

Top Sources:
${summary.topSources.map((s) => `- ${s.title} (${s.url})`).join("\n")}

Generate a comprehensive research report based on these findings. Output clean HTML that can be directly used in a document.`,
      system: SYSTEM_PROMPT,
      maxTokens: 2000, // Limit output tokens
    });

    return { report: text };
  },
});
