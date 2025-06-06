import { z } from "zod";

export const DeepResearchStatus = z.enum([
  "generating-search-queries",
  "generating-search-results",
  "generating-learnings",
  "generating-report",
  "generating-pdf",
  "uploading-pdf-to-r2",
  "completed",
  "failed",
]);

export const DeepResearchMetadataSchema = z.object({
  status: DeepResearchStatus,
  progress: z.number().optional(),
  message: z.string().optional(),
  currentStep: z.string().optional(),
  totalSteps: z.number().optional(),
  finalUrl: z.string().optional(),
});

export type DeepResearchMetadata = z.infer<typeof DeepResearchMetadataSchema>;
