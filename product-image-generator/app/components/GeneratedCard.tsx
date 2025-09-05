"use client";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Download, RefreshCw, Expand, ImageIcon } from "lucide-react";
import { useState } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

interface GeneratedCardProps {
  runId: string | null;
  accessToken: string | null;
  promptId: string;
  promptTitle: string;
  onRetry?: () => void;
}

export default function GeneratedCard({
  runId,
  accessToken,
  promptId,
  promptTitle,
  onRetry,
}: GeneratedCardProps) {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );

  // Use the React hook for realtime run subscription
  const { run, error } = useRealtimeRun(runId || undefined, {
    accessToken: accessToken || undefined,
    enabled: !!(runId && accessToken), // Only subscribe if we have both
  });

  // Extract progress information from run metadata
  const progressData = run?.metadata?.progress as
    | {
        step: number;
        total: number;
        message: string;
      }
    | undefined;

  const isLoading = run?.status === "EXECUTING" || run?.status === "QUEUED";
  const generationProgress =
    run?.status === "COMPLETED"
      ? "completed"
      : run?.status === "FAILED"
      ? "failed"
      : run?.status === "EXECUTING"
      ? "generating"
      : "idle";

  // Update generated image URL when run completes
  if (run?.status === "COMPLETED" && !generatedImageUrl) {
    // First try to get publicUrl from output
    let publicUrl = run.output?.publicUrl;

    // If not in output, try metadata.result (our new pattern)
    if (!publicUrl && run.metadata?.result) {
      const result = run.metadata.result as any;
      publicUrl = result.publicUrl;
    }

    if (publicUrl) {
      setGeneratedImageUrl(publicUrl);
    }
  }

  const handleDownload = () => {
    if (generatedImageUrl) {
      const link = document.createElement("a");
      link.href = generatedImageUrl;
      link.download = `generated-${promptId}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExpand = () => {
    if (generatedImageUrl) {
      window.open(generatedImageUrl, "_blank");
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      setGeneratedImageUrl(null);
      onRetry();
    }
  };

  return (
    <Card className="aspect-[3/4] border transition-colors relative overflow-hidden group bg-card p-0">
      {generatedImageUrl ? (
        // Show generated image
        <div className="h-full w-full relative overflow-hidden rounded-lg">
          <img
            src={generatedImageUrl}
            alt={`Generated ${promptTitle}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleExpand}
            >
              <Expand className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <p className="text-white text-sm font-medium drop-shadow-sm">
              {promptTitle}
            </p>
          </div>
        </div>
      ) : generationProgress === "failed" ? (
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
          {onRetry && (
            <Button size="sm" variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      ) : (
        // Show loading/waiting state
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
            {isLoading && generationProgress === "generating" ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {promptTitle}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {progressData?.message ||
              (generationProgress === "generating"
                ? "Generating..."
                : generationProgress === "idle"
                ? "Waiting to start..."
                : "Ready")}
          </p>
          {progressData && generationProgress === "generating" && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progressData.step / progressData.total) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Step {progressData.step} of {progressData.total}
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
