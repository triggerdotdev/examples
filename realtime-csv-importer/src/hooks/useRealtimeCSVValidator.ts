"use client";

import { csvValidator } from "@/trigger/csv";
import { CSVBatchStatus, CSVUploadMetadataSchema } from "@/utils/schemas";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

type UseCSVUploadInstance = {
  status:
    | "loading"
    | "queued"
    | "fetching"
    | "parsing"
    | "processing"
    | "complete"
    | "error";
  filename?: string;
  progress: number;
  message: string;
  totalRows?: number;
  totalProcessed?: number;
  batches?: Array<CSVBatchStatus>;
  totalValid?: number;
  totalInvalid?: number;
  totalApiCalls?: number;
  durationInSeconds?: number;
};

export function useRealtimeCSVValidator(
  runId?: string,
  accessToken?: string
): UseCSVUploadInstance {
  const instance = useRealtimeRun<typeof csvValidator>(runId, {
    accessToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    enabled: !!runId && !!accessToken,
  });

  if (!instance.run) {
    return { status: "loading", progress: 0, message: "Loading..." };
  }

  const startedAt = instance.run.startedAt;
  const finishedAt = instance.run.finishedAt;

  const durationInSeconds =
    startedAt && finishedAt
      ? (finishedAt.getTime() - startedAt.getTime()) / 1000
      : undefined;

  console.log("CSV Upload", instance.run);

  if (!instance.run.metadata) {
    return {
      status: "queued",
      progress: 0.05,
      message: "Queued...",
      filename: instance.run.payload.name,
    };
  }

  const parsedMetadata = CSVUploadMetadataSchema.safeParse(
    instance.run.metadata
  );

  if (!parsedMetadata.success) {
    return {
      status: "error",
      progress: 0,
      message: "Failed to parse metadata",
      filename: instance.run.payload.name,
    };
  }

  switch (parsedMetadata.data.status) {
    case "fetching": {
      return {
        status: "fetching",
        progress: 0.1,
        message: "Fetching CSV file...",
        filename: instance.run.payload.name,
      };
    }
    case "parsing": {
      return {
        status: "parsing",
        progress: 0.2,
        message: "Parsing CSV file...",
        filename: instance.run.payload.name,
      };
    }
    case "processing": {
      // progress will be some number between 0.3 and 0.95
      // depending on the totalRows and processedRows

      const progress =
        typeof parsedMetadata.data.totalProcessed === "number" &&
        typeof parsedMetadata.data.totalRows === "number"
          ? 0.3 +
            (parsedMetadata.data.totalProcessed /
              parsedMetadata.data.totalRows) *
              0.65
          : 0.3;

      return {
        status: "processing",
        progress: progress,
        message: "Processing CSV file...",
        totalRows: parsedMetadata.data.totalRows,
        totalProcessed: parsedMetadata.data.totalProcessed,
        filename: instance.run.payload.name,
        batches: parsedMetadata.data.batches,
        totalValid: parsedMetadata.data.totalValid,
        totalInvalid: parsedMetadata.data.totalInvalid,
        totalApiCalls: parsedMetadata.data.totalApiCalls,
        durationInSeconds,
      };
    }
    case "complete": {
      return {
        status: "complete",
        progress: 1,
        message: "CSV processing complete",
        totalRows: parsedMetadata.data.totalRows,
        totalProcessed: parsedMetadata.data.totalProcessed,
        filename: instance.run.payload.name,
        batches: parsedMetadata.data.batches,
        totalValid: parsedMetadata.data.totalValid,
        totalInvalid: parsedMetadata.data.totalInvalid,
        totalApiCalls: parsedMetadata.data.totalApiCalls,
        durationInSeconds,
      };
    }
  }
}
