"use client";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Download, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { runs, configure } from "@trigger.dev/sdk/v3";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [generationProgress, setGenerationProgress] = useState<string>("idle");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressStep, setProgressStep] = useState<{
    step: number;
    total: number;
  } | null>(null);

  // Subscribe to run updates when runId and accessToken are available
  useEffect(() => {
    if (!runId || !accessToken) return;

    const subscribeToRun = async () => {
      setIsLoading(true);
      setGenerationProgress("generating");
      setError(null);

      try {
        configure({
          secretKey: accessToken,
        });

        for await (const run of runs.subscribeToRun(runId)) {
          // Update progress from metadata
          if (run.metadata?.progress) {
            const progress = run.metadata.progress as {
              step: number;
              total: number;
              message: string;
            };
            setProgressMessage(progress.message);
            setProgressStep({ step: progress.step, total: progress.total });
          }

          // Handle completion
          if (run.status === "COMPLETED" && run.output) {
            setGeneratedImageUrl(run.output.publicUrl);
            setGenerationProgress("completed");
            setProgressMessage("Generation completed!");
            setIsLoading(false);
            break;
          } else if (run.status === "FAILED") {
            const errorMsg = run.metadata?.error || "Generation failed";
            setError(
              typeof errorMsg === "string" ? errorMsg : "Generation failed"
            );
            setGenerationProgress("failed");
            setProgressMessage("");
            setIsLoading(false);
            break;
          }
        }
      } catch (err) {
        setError("Failed to get task updates");
        setGenerationProgress("failed");
        setIsLoading(false);
      }
    };

    subscribeToRun();
  }, [runId, accessToken]);

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

  const handleRetry = () => {
    if (onRetry) {
      setError(null);
      setGeneratedImageUrl(null);
      setGenerationProgress("idle");
      setProgressMessage("");
      setProgressStep(null);
      onRetry();
    }
  };

  return (
    <Card className="aspect-[3/4] border transition-colors relative overflow-hidden group bg-card">
      {generatedImageUrl ? (
        // Show generated image
        <div className="h-full w-full relative">
          <img
            src={generatedImageUrl}
            alt={`Generated ${promptTitle}`}
            className="h-full w-full object-contain rounded-lg bg-gray-50"
          />
          {/* Download button */}
          <div className="absolute top-2 right-2">
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <p className="text-white text-sm font-medium">{promptTitle}</p>
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
          <p className="text-xs text-red-600 mb-3">{error}</p>
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
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {isLoading && generationProgress === "generating" ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : (
              <div className="w-6 h-6 bg-primary/20 rounded-full"></div>
            )}
          </div>
          <p className="text-sm font-medium text-card-foreground mb-1">
            {promptTitle}
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            {generationProgress === "generating"
              ? progressMessage || "Generating..."
              : generationProgress === "idle"
              ? "Waiting to start..."
              : "Ready"}
          </p>
          {progressStep && generationProgress === "generating" && (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progressStep.step / progressStep.total) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Step {progressStep.step} of {progressStep.total}
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
