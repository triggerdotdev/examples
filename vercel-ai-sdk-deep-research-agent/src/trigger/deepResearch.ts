import { metadata, schemaTask, task, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, tool } from "ai";
import { generatePdfAndUpload } from "./generatePdfAndUpload";
import { searchAndProcess } from "./searchAndProcess";
import { generateSearchQueries } from "./generateSearchQueries";
import { generateLearnings } from "./generateLearnings";
import { generateReport } from "./generateReport";

export const mainLLM = openai("gpt-4o-mini");
export const fastLLM = openai("gpt-4o-mini");

export type Learning = {
  learning: string;
  followUpQuestions: string[];
};

export type SearchResult = {
  title: string;
  url: string;
  content: string;
};

export type Research = {
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
    metadata.set("status", {
      progress: 0,
      label: "Starting research...",
    });

    const maxDepth = payload.maxDepth || 2;
    const maxBreadth = payload.maxBreadth || 3;

    const research: Research = {
      query: payload.prompt,
      queries: [],
      searchResults: [],
      learnings: [],
    };

    const searchQueriesResult = await generateSearchQueries.triggerAndWait({
      prompt: payload.prompt,
      breadth: maxBreadth,
    });

    metadata.set("status", {
      progress: 5,
      label: "Generated initial search queries.",
    });

    // Small delay to ensure UI shows this update
    await wait.for({ seconds: 1 });

    if (!searchQueriesResult.ok) {
      throw new Error(
        `Failed to generate search queries: ${searchQueriesResult.error}`,
      );
    }

    let currentQueries = searchQueriesResult.output.queries;
    research.queries = currentQueries;
    const progressPerDepth = (70 - 5) / maxDepth; // Progress from 5% to 70%

    // Iterative approach instead of recursion
    for (let depth = 0; depth < maxDepth; depth++) {
      // Stop if no more queries to explore
      if (currentQueries.length === 0) {
        break;
      }

      const nextLevelQueries: string[] = [];

      const baseProgress = 5 + depth * progressPerDepth;
      metadata.set("status", {
        progress: Math.round(baseProgress),
        label: `Depth ${
          depth + 1
        }/${maxDepth}: Performing ${currentQueries.length} searches in parallel.`,
      });

      // Parallelize search processing for all queries at this depth level
      console.log(
        `Depth ${depth}: Processing ${currentQueries.length} queries in parallel`,
      );

      const searchBatch = await searchAndProcess.batchTriggerAndWait(
        currentQueries.map((query) => ({
          payload: { query, accumulatedSources: research.searchResults },
        })),
      );

      // Process all search results
      for (let i = 0; i < searchBatch.runs.length; i++) {
        const searchResult = searchBatch.runs[i];
        const originalQuery = currentQueries[i];

        if (!searchResult.ok) {
          console.error(
            `Failed to search for "${originalQuery}": ${searchResult.error}`,
          );
          continue;
        }

        const progressAfterSearch = Math.round(
          baseProgress + progressPerDepth / 2,
        );
        metadata.set("status", {
          progress: progressAfterSearch,
          label: `Depth ${
            depth + 1
          }/${maxDepth}: Analyzing ${searchResult.output.length} results for "${originalQuery}".`,
        });

        // Small delay to ensure UI shows this update
        await wait.for({ seconds: 0.5 });

        research.searchResults.push(...searchResult.output);

        // Only batch trigger if we have results
        if (searchResult.output.length > 0) {
          // Parallelize learning generation for all search results from this query
          metadata.set("status", {
            progress: progressAfterSearch,
            label: `Depth ${
              depth + 1
            }/${maxDepth}: Synthesizing learnings from ${searchResult.output.length} sources for "${originalQuery}".`,
          });

          // Small delay to ensure UI shows this update
          await wait.for({ seconds: 0.5 });

          const learningBatch = await generateLearnings.batchTriggerAndWait(
            searchResult.output.map((result) => ({
              payload: {
                query: originalQuery,
                searchResult: result,
              },
            })),
          );

          // Collect learnings and follow-up questions
          for (const learning of learningBatch.runs) {
            if (!learning.ok) {
              console.error(`Failed to generate learnings: ${learning.error}`);
              continue;
            }

            research.learnings.push(learning.output);

            // Add follow-up questions for next depth level
            nextLevelQueries.push(
              ...learning.output.followUpQuestions.slice(
                0,
                Math.ceil(maxBreadth / (depth + 1)),
              ),
            );
          }
        }
      }

      // Prepare queries for next depth level
      currentQueries = nextLevelQueries.slice(0, maxBreadth);
    }

    metadata.set("status", {
      progress: 70,
      label: "Compiling all research into a final report.",
    });

    // Small delay to ensure UI shows this update
    await wait.for({ seconds: 1 });

    const report = await generateReport.triggerAndWait({ research });

    if (!report.ok) {
      throw new Error(`Failed to generate report: ${report.error}`);
    }

    // Generate and upload PDF
    metadata.set("status", {
      progress: 85,
      label: "Generating PDF and uploading to R2...",
    });

    const pdfName = "deep-research-" + Date.now();
    metadata.set("pdfName", pdfName);

    const pdfResult = await generatePdfAndUpload.triggerAndWait({
      report: report.output.report,
      title: payload.prompt,
      name: pdfName,
    });

    if (!pdfResult.ok) {
      console.error(`PDF generation failed: ${pdfResult.error}`);
      metadata.set("status", {
        progress: 100,
        label: "Research complete (PDF generation failed).",
      });
      return report.output.report; // Return just the HTML if PDF fails
    }

    metadata.set("status", {
      progress: 100,
      label: "Research complete!",
    });

    return {
      name: pdfName,
      report: report.output.report,
      pdfLocation: pdfResult.output.pdfLocation,
    };
  },
});
