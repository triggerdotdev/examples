"use client";

import { useSearchParams } from "next/navigation";
import { ImageUploadDropzone } from "./ImageUploadButton";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { generateImage } from "@/trigger/generate-images";
import { z } from "zod";
import { Button } from "./ui/button";

type UploadCardProps = {
  runId?: string;
  accessToken?: string;
  fileUrl?: string;
};

export function UploadCard({ runId, accessToken, fileUrl }: UploadCardProps) {
  const isGenerating = Boolean(runId && accessToken);

  // Subscribe to the run
  const { run, error } = useRealtimeRun<typeof generateImage>(runId, {
    accessToken: accessToken,
    enabled: isGenerating,
  });

  const metadata =
    MetadataSchema.nullable().safeParse(run?.metadata).data ?? null;

  return (
    <div className="aspect-[3/4] w-full border transition-colors relative overflow-hidden group bg-card p-0 rounded-lg">
      {fileUrl ? (
        <div className="h-full w-full relative group">
          <img
            src={fileUrl}
            alt="Uploaded image"
            className="h-full w-full object-contain rounded-lg bg-gray-50"
            style={{
              opacity: metadata?.status === "completed" ? 1 : 0.7,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
          {metadata?.status === "completed" && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                Replace
              </Button>
            </div>
          )}
        </div>
      ) : (
        <ImageUploadDropzone />
      )}
    </div>
  );
}

const MetadataSchema = z.object({
  status: z.union([z.literal("starting"), z.literal("completed")]),
  progress: z.object({
    step: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    message: z.string(),
  }),
});
