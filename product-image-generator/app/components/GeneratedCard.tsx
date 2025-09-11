"use client";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Download,
  RefreshCw,
  Expand,
  ImageIcon,
  Sparkles,
  LucideLoader,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { triggerGenerationTask } from "../actions";
import type { generateAndUploadImage } from "../../src/trigger/generate-and-upload-image";
import type { ProductAnalysis } from "../types/trigger";

interface GeneratedCardProps {
  baseImageUrl: string | null;
  productAnalysis: ProductAnalysis | null;
  promptId: string;
  promptTitle: string;
  onGenerationComplete?: (
    runId: string,
    promptId: string,
    promptTitle: string,
    imageUrl?: string
  ) => void;
}

export default function GeneratedCard({
  baseImageUrl,
  productAnalysis,
  promptId,
  promptTitle,
  onGenerationComplete,
}: GeneratedCardProps) {
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [hasTriggered, setHasTriggered] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [publicAccessToken, setPublicAccessToken] = useState<string | null>(
    null
  );

  // Subscribe to the run if we have a runId and token
  const { run, error } = useRealtimeRun<typeof generateAndUploadImage>(
    runId ?? undefined,
    {
      accessToken: publicAccessToken ?? "",
      enabled: Boolean(runId && publicAccessToken),
    }
  );

  const handleGenerate = useCallback(async () => {
    if (!baseImageUrl || !productAnalysis || hasTriggered) {
      return;
    }

    try {
      setHasTriggered(true);
      setIsGenerating(true);

      const result = await triggerGenerationTask({
        promptStyle: promptId,
        baseImageUrl,
        productAnalysis,
      });

      if (result.success) {
        setRunId(result.runId);
        setPublicAccessToken(result.publicAccessToken);
      } else {
        console.error("Generation failed:", result.error);
        setHasTriggered(false);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
      setHasTriggered(false);
      setIsGenerating(false);
    }
  }, [baseImageUrl, productAnalysis, hasTriggered, promptId]);

  // Auto-trigger when data is available
  useEffect(() => {
    if (!hasTriggered && baseImageUrl && productAnalysis) {
      handleGenerate();
    }
  }, [hasTriggered, baseImageUrl, productAnalysis, handleGenerate]);

  // Extract progress information from run metadata
  const progressData = run?.metadata?.progress as
    | {
        step: number;
        total: number;
        message: string;
      }
    | undefined;

  const isTaskRunning =
    isGenerating || run?.status === "EXECUTING" || run?.status === "QUEUED";
  const generationProgress =
    run?.status === "COMPLETED"
      ? "completed"
      : run?.status === "FAILED" || error
      ? "failed"
      : run?.status === "EXECUTING"
      ? "generating"
      : "idle";

  // Update generated image URL when run completes
  if (run?.status === "COMPLETED") {
    // First try to get publicUrl from output
    let publicUrl = run.output?.publicUrl;

    // If not in output, try metadata.result (our new pattern)
    if (!publicUrl && run.metadata?.result) {
      const result = run.metadata.result as any;
      publicUrl = result.publicUrl;
    }

    if (publicUrl && publicUrl !== generatedImageUrl) {
      setGeneratedImageUrl(publicUrl);
      setIsRegenerating(false); // Clear regenerating state when new image loads

      // Notify parent of generation completion
      if (run?.id && onGenerationComplete) {
        onGenerationComplete(run.id, promptId, promptTitle, publicUrl);
      }
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
    setIsRegenerating(true);
    setHasTriggered(false);
    setIsGenerating(false);
    setRunId(null);
    setPublicAccessToken(null);
    handleGenerate();
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
          {/* Regenerating overlay */}
          {isRegenerating && isTaskRunning && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-4 transition-colors ">
                  <div className="animate-spin h-6 w-6">
                    <Loader2 className="h-6 w-6 text-gray-500" />
                  </div>
                </div>
                <p className="text-white text-sm font-medium">
                  Regenerating...
                </p>
              </div>
            </div>
          )}
          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleRetry}
              disabled={isRegenerating && isTaskRunning}
              title="Regenerate image"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleExpand}
              disabled={isRegenerating && isTaskRunning}
              title="View full size"
            >
              <Expand className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleDownload}
              disabled={isRegenerating && isTaskRunning}
              title="Download image"
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
          <Button size="sm" variant="outline" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        // Show loading/waiting state
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-lg bg-gray-300/20 flex items-center justify-center mb-4">
            {isTaskRunning && generationProgress === "generating" ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : baseImageUrl && productAnalysis && !hasTriggered ? (
              <Button
                size="sm"
                onClick={handleGenerate}
                className="w-8 h-8 rounded-full p-0"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
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
                ? ""
                : baseImageUrl && productAnalysis && !hasTriggered
                ? "Click to generate"
                : "Waiting for upload...")}
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
