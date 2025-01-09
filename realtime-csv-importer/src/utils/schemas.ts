import { z } from "zod";

export const UploadedFileData = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  key: z.string(),
  url: z.string(),
  appUrl: z.string(),
  fileHash: z.string(),
  customId: z.string().nullable(),
});

export type UploadedFileData = z.infer<typeof UploadedFileData>;

export const CSVRow = z.record(z.any());

export type CSVRow = z.infer<typeof CSVRow>;

// Status schema for progress updates
export const CSVStatus = z.enum([
  "fetching",
  "parsing",
  "processing",
  "complete",
]);

export type CSVStatus = z.infer<typeof CSVStatus>;

export const CSVBatchStatus = z.object({
  status: z.enum(["queued", "processing", "complete"]),
  count: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  valid: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
});

export type CSVBatchStatus = z.infer<typeof CSVBatchStatus>;

// The full metadata schema that encompasses all possible metadata fields
export const CSVUploadMetadataSchema = z.object({
  status: CSVStatus,
  batches: z.array(CSVBatchStatus).default([]),
  totalApiCalls: z.number().int().nonnegative().default(0),
  totalRows: z.number().int().nonnegative().default(0),
  totalProcessed: z.number().int().nonnegative().default(0),
  totalValid: z.number().int().nonnegative().default(0),
  totalInvalid: z.number().int().nonnegative().default(0),
});

export type CSVUploadMetadata = z.infer<typeof CSVUploadMetadataSchema>;
