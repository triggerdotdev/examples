"use client";

import { DeepResearchMetadataSchema } from "@/lib/schemas";
import type { deepResearch } from "@/trigger/deepResearch";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

type UseDeepResearchInstance = {
  status:
    | "loading"
    | "queued"
    | "generating-search-queries"
    | "generating-search-results"
    | "generating-learnings"
    | "generating-report"
    | "generating-pdf"
    | "uploading-pdf-to-r2"
    | "completed"
    | "failed";
  prompt?: string;
  progress: number;
  message: string;
  durationInSeconds?: number;
  finalUrl?: string;
};

export function useRealtimeDeepResearch(
  runId?: string,
  accessToken?: string,
): UseDeepResearchInstance {
  const instance = useRealtimeRun<typeof deepResearch>(runId, {
    accessToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    enabled: !!runId && !!accessToken,
  });

  if (!instance.run) {
    return { status: "loading", progress: 0, message: " " };
  }

  const { run } = instance;
  const { payload, startedAt, finishedAt, metadata: rawMetadata } = run;

  const durationInSeconds = startedAt && finishedAt
    ? (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000
    : undefined;

  if (!rawMetadata) {
    return {
      status: "queued",
      progress: 0.01,
      message: "Queued for processing...",
      prompt: payload.prompt,
    };
  }

  const parsedMetadata = DeepResearchMetadataSchema.safeParse(rawMetadata);

  if (!parsedMetadata.success) {
    return {
      status: "failed",
      progress: 0,
      message: "Failed to parse metadata.",
      prompt: payload.prompt,
    };
  }

  const metadata = parsedMetadata.data;
  const stepProgress = metadata.progress ?? 0;

  switch (metadata.status) {
    case "generating-search-queries":
      return {
        status: "generating-search-queries",
        progress: 0 + stepProgress * 0.1, // 0-10%
        message: metadata.message ?? "Generating search queries...",
        prompt: payload.prompt,
      };
    case "generating-search-results":
      return {
        status: "generating-search-results",
        progress: 0.1 + stepProgress * 0.15, // 10-25%
        message: metadata.message ?? "Gathering search results...",
        prompt: payload.prompt,
      };
    case "generating-learnings":
      return {
        status: "generating-learnings",
        progress: 0.25 + stepProgress * 0.5, // 25-75%
        message: metadata.message ?? "Generating learnings from results...",
        prompt: payload.prompt,
      };
    case "generating-report":
      return {
        status: "generating-report",
        progress: 0.75 + stepProgress * 0.1, // 75-85%
        message: metadata.message ?? "Compiling the final report...",
        prompt: payload.prompt,
      };
    case "generating-pdf":
      return {
        status: "generating-pdf",
        progress: 0.85 + stepProgress * 0.1, // 85-95%
        message: metadata.message ?? "Generating PDF report...",
        prompt: payload.prompt,
      };
    case "uploading-pdf-to-r2":
      return {
        status: "uploading-pdf-to-r2",
        progress: 0.95 + stepProgress * 0.05, // 95-100%
        message: metadata.message ?? "Uploading final report...",
        prompt: payload.prompt,
      };
    case "completed":
      return {
        status: "completed",
        progress: 1,
        message: metadata.message ?? "Research complete.",
        prompt: payload.prompt,
        durationInSeconds,
        finalUrl: metadata.finalUrl,
      };
    case "failed":
      return {
        status: "failed",
        progress: 1, // Show full bar but in error state
        message: metadata.message ?? "Research failed.",
        prompt: payload.prompt,
        durationInSeconds,
      };
    default: {
      // This will cause a TypeScript error if a status is not handled.
      const _exhaustiveCheck: never = metadata.status;
      return {
        status: "failed",
        progress: 0,
        message: "An unknown error occurred.",
        prompt: payload.prompt,
      };
    }
  }
}
