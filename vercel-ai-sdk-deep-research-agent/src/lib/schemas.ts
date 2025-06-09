import { z } from "zod";

export const ProgressMetadataSchema = z.object({
  status: z.object({
    progress: z.number(),
    label: z.string(),
  }),
});

export type ProgressMetadata = z.infer<typeof ProgressMetadataSchema>;

export function parseStatus(data: unknown): ProgressMetadata {
  return ProgressMetadataSchema.parse(data);
}
