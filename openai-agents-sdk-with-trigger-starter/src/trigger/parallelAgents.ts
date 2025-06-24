import { Agent, run } from "@openai/agents";
import { batch, logger, task } from "@trigger.dev/sdk";

// Example payload for testing:
// {
//   "text": "The new iPhone 15 has amazing battery life and camera quality. However, the price is quite high for what you get.",
//   "includeWordCount": true,
//   "language": "english"
// }

export interface TextAnalysisPayload {
  text: string;
  includeWordCount?: boolean;
  language?: "english" | "spanish" | "french" | "general";
}

// Create individual agent tasks that can be run in parallel
export const analyzeTextSentiment = task({
  id: "analyze-sentiment",
  run: async (payload: { text: string; language?: string }) => {
    const agent = new Agent({
      name: "Sentiment Analyzer",
      instructions: `Analyze the sentiment of the given text in ${
        payload.language || "english"
      }. Respond with: POSITIVE, NEGATIVE, or NEUTRAL, followed by a brief explanation.`,
    });

    const result = await run(
      agent,
      `Analyze the sentiment of this text: "${payload.text}"`,
    );
    return {
      analysis: result.finalOutput,
      agentName: agent.name,
    };
  },
});

export const extractKeywords = task({
  id: "extract-keywords",
  run: async (payload: { text: string; includeWordCount?: boolean }) => {
    const agent = new Agent({
      name: "Keyword Extractor",
      instructions:
        `Extract the 5 most important keywords from the given text. Return them as a comma-separated list.
      ${payload.includeWordCount ? "Also include the total word count." : ""}`,
    });

    const result = await run(
      agent,
      `Extract keywords from this text: "${payload.text}"`,
    );
    return {
      keywords: result.finalOutput,
      agentName: agent.name,
    };
  },
});

export const summarizeText = task({
  id: "summarize-text",
  run: async (payload: { text: string; language?: string }) => {
    const agent = new Agent({
      name: "Text Summarizer",
      instructions:
        `Create a concise 1-2 sentence summary of the given text in ${
          payload.language || "english"
        }, capturing the main points.`,
    });

    const result = await run(agent, `Summarize this text: "${payload.text}"`);
    return {
      summary: result.finalOutput,
      agentName: agent.name,
    };
  },
});

// Main orchestrator task that runs all analysis in parallel
export const parallelAgents = task({
  id: "parallel-agents",
  maxDuration: 180,
  run: async (payload: TextAnalysisPayload) => {
    logger.info("Starting parallel agent analysis", {
      textLength: payload.text.length,
      language: payload.language,
      includeWordCount: payload.includeWordCount,
    });

    const startTime = Date.now();

    // Run all three analysis tasks in parallel using batch.triggerByTaskAndWait
    const results = await batch.triggerByTaskAndWait([
      {
        task: analyzeTextSentiment,
        payload: { text: payload.text, language: payload.language },
      },
      {
        task: extractKeywords,
        payload: {
          text: payload.text,
          includeWordCount: payload.includeWordCount,
        },
      },
      {
        task: summarizeText,
        payload: { text: payload.text, language: payload.language },
      },
    ]);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Process results
    const sentiment = results.runs[0].ok ? results.runs[0].output : null;
    const keywords = results.runs[1].ok ? results.runs[1].output : null;
    const summary = results.runs[2].ok ? results.runs[2].output : null;

    logger.info("Parallel agent analysis completed", {
      executionTime,
      successfulTasks: results.runs.filter((r) => r.ok).length,
      totalTasks: results.runs.length,
      language: payload.language || "english",
    });

    return {
      originalText: payload.text,
      sentiment: sentiment?.analysis,
      keywords: keywords?.keywords,
      summary: summary?.summary,
      executionTime,
      parallelTasks: 3,
      language: payload.language || "english",
      includeWordCount: payload.includeWordCount || false,
      agents: [
        sentiment?.agentName,
        keywords?.agentName,
        summary?.agentName,
      ].filter(Boolean),
    };
  },
});
