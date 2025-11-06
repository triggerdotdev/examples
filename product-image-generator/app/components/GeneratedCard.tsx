"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Download, Expand, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import z from "zod";
import type { generateImage } from "../trigger/generate-images";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface GeneratedCardProps {
  id: string;
  runId?: string;
  accessToken?: string;
  promptTitle: string;
}

export function GeneratedCard({
  id,
  runId,
  accessToken,
  promptTitle,
}: GeneratedCardProps) {
  const isGenerating = Boolean(runId && accessToken);

  // Subscribe to the run
  const { run, error } = useRealtimeRun<typeof generateImage>(runId, {
    accessToken: accessToken,
    enabled: isGenerating,
  });

  const status = isGenerating
    ? run?.isCompleted
      ? "completed"
      : run?.isFailed
      ? "failed"
      : "generating"
    : "idle";

  const metadata =
    MetadataSchema.nullable().safeParse(run?.metadata?.[id]).data ?? null;

  return (
    <Card className="aspect-[3/4] border transition-colors relative overflow-hidden group bg-card p-0">
      {status === "completed" ? (
        <div className="h-full w-full relative overflow-hidden rounded-lg">
          <img
            src={metadata?.result?.publicUrl}
            alt={`Generated ${promptTitle}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={() => window.open(metadata?.result?.publicUrl, "_blank")}
              disabled={!metadata?.result?.publicUrl}
              title="View full size"
            >
              <Expand className="h-4 w-4" />
            </Button>
          </div>
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <p className="text-white text-sm font-medium drop-shadow-sm">
              {promptTitle}
            </p>
          </div>
        </div>
      ) : status === "failed" ? (
        // Show error state
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <RefreshCw className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-sm font-medium text-card-foreground mb-2">
            {promptTitle}
          </p>
          <p className="text-xs text-red-600 mb-3">
            {error?.message || "Generation failed"}
          </p>
          <Button size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        // Show loading/waiting state
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
              status === "generating" ? "" : "bg-gray-300/20"
            }`}
          >
            {status === "generating" ? (
              <div className="animate-spin h-6 w-6">
                <Loader2 className="h-6 w-6 text-gray-500" />
              </div>
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {promptTitle}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {status === "generating"
              ? "Generating..."
              : "Waiting for upload..."}
          </p>
        </div>
      )}
    </Card>
  );
}

const MetadataSchema = z.object({
  status: z.union([
    z.literal("starting"),
    z.literal("generating"),
    z.literal("uploading"),
    z.literal("completed"),
    z.literal("failed"),
  ]),
  message: z.string(),
  result: z
    .object({
      publicUrl: z.string(),
    })
    .optional(),
});
