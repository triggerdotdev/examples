import { openai } from "@ai-sdk/openai";
import { batch, logger, task } from "@trigger.dev/sdk/v3";
import { CoreMessage, generateText } from "ai";

// Define types for our workers' outputs
interface Claim {
  id: number;
  text: string;
}

interface SourceVerification {
  claimId: number;
  isVerified: boolean;
  confidence: number;
  explanation: string;
}

interface HistoricalAnalysis {
  claimId: number;
  feasibility: number;
  historicalContext: string;
}

// Worker 1: Claim Extractor
export const extractClaims = task({
  id: "extract-claims",
  run: async ({ article }: { article: string }) => {
    try {
      const messages: CoreMessage[] = [
        {
          role: "system",
          content:
            "Extract distinct factual claims from the news article. Format as numbered claims.",
        },
        {
          role: "user",
          content: article,
        },
      ];

      const response = await generateText({
        model: openai("o1-mini"),
        messages,
      });

      const claims = response.text
        .split("\n")
        .filter((line: string) => line.trim())
        .map((claim: string, index: number) => ({
          id: index + 1,
          text: claim.replace(/^\d+\.\s*/, ""),
        }));

      logger.info("Extracted claims", { claimCount: claims.length });
      return claims;
    } catch (error) {
      logger.error("Error in claim extraction", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

// Worker 2: Source Verifier
export const verifySource = task({
  id: "verify-source",
  run: async (claim: Claim) => {
    const response = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content:
            "Verify this claim by considering recent news sources and official statements. Assess reliability.",
        },
        {
          role: "user",
          content: claim.text,
        },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "verify-source",
      },
    });

    return {
      claimId: claim.id,
      isVerified: false,
      confidence: 0.7,
      explanation: response.text,
    };
  },
});

// Worker 3: Historical Context Analyzer
export const analyzeHistory = task({
  id: "analyze-history",
  run: async (claim: Claim) => {
    const response = await generateText({
      model: openai("o1-mini"),
      messages: [
        {
          role: "system",
          content:
            "Analyze this claim in historical context, considering past announcements and technological feasibility.",
        },
        {
          role: "user",
          content: claim.text,
        },
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "analyze-history",
      },
    });

    return {
      claimId: claim.id,
      feasibility: 0.8,
      historicalContext: response.text,
    };
  },
});

// Orchestrator
export const newsFactChecker = task({
  id: "news-fact-checker",
  run: async ({ article }: { article: string }) => {
    // Step 1: Extract claims
    const claimsResult = await batch.triggerByTaskAndWait([
      { task: extractClaims, payload: { article } },
    ]);

    if (!claimsResult.runs[0].ok) {
      logger.error("Failed to extract claims", {
        error: claimsResult.runs[0].error,
        runId: claimsResult.runs[0].id,
      });
      throw new Error(
        `Failed to extract claims: ${claimsResult.runs[0].error}`
      );
    }

    const claims = claimsResult.runs[0].output;

    // Step 2: Process claims in parallel
    const parallelResults = await batch.triggerByTaskAndWait([
      ...claims.map((claim) => ({ task: verifySource, payload: claim })),
      ...claims.map((claim) => ({ task: analyzeHistory, payload: claim })),
    ]);

    // Split and process results
    const verifications = parallelResults.runs
      .filter(
        (run): run is typeof run & { ok: true } =>
          run.ok && run.taskIdentifier === "verify-source"
      )
      .map((run) => run.output as SourceVerification);

    const historicalAnalyses = parallelResults.runs
      .filter(
        (run): run is typeof run & { ok: true } =>
          run.ok && run.taskIdentifier === "analyze-history"
      )
      .map((run) => run.output as HistoricalAnalysis);

    return { claims, verifications, historicalAnalyses };
  },
});
