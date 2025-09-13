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
      {/* {publicUrl ? (
        // Show uploaded image
        <div className="h-full w-full relative group">
          <img
            src={publicUrl}
            alt="Uploaded image"
            className="h-full w-full object-contain rounded-lg bg-gray-50"
            style={{
              opacity: run?.status === "COMPLETED" ? 1 : 0.7,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
          {(isUploading ||
            isLoading ||
            run?.status === "EXECUTING" ||
            run?.status === "QUEUED") && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
            >
              Replace
            </Button>
          </div>
        </div>
      ) : isUploading || isLoading || run?.id || progress ? (
        // Show progress state when loading or run exists
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-8 h-8 rounded-full flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-6 w-6">
              <LucideLoader className="h-6 w-6 text-gray-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {progress?.message ||
              (isUploading ? "Starting upload..." : "Processing...")}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress
              ? `Step ${progress.step} of ${progress.total}`
              : isUploading
              ? "Preparing..."
              : "Please wait"}
          </p>

          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{
                width: progress
                  ? `${(progress.step / progress.total) * 100}%`
                  : "0%",
              }}
            ></div>
          </div>

          {run?.id && (
            <p className="text-xs text-gray-600 mt-2">Run ID: {run.id}</p>
          )}
          {error && (
            <p className="text-xs text-red-600 mt-2">Error: {error.message}</p>
          )}
        </div>
      ) : (
        // Show upload area
        <div className="h-full flex flex-col items-center justify-center p-3 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
              isDragOver
                ? "bg-gray-500/10"
                : "bg-gray-500/10 group-hover:bg-gray-500/20 transition duration-200"
            }`}
          >
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            Drag and drop an image here
          </p>
          <p className="text-xs text-muted-foreground">or click to upload</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      /> */}
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
