"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import {
  RefreshCw,
  Send,
  Expand,
  Download,
  ImageIcon,
  Sparkles,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { triggerGenerationTask } from "../actions";
import type { generateAndUploadImage } from "../../src/trigger/generate-and-upload-image";
import type { ProductAnalysis } from "../types/trigger";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface CustomPromptCardProps {
  baseImageUrl: string | null;
  productAnalysis: ProductAnalysis | null;
  onGenerationComplete?: (
    runId: string,
    prompt: string,
    imageUrl?: string
  ) => void;
}

export default function CustomPromptCard({
  baseImageUrl,
  productAnalysis,
  onGenerationComplete,
}: CustomPromptCardProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [publicAccessToken, setPublicAccessToken] = useState<string | null>(
    null
  );
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Subscribe to the run if we have a runId and token
  const { run, error } = useRealtimeRun<typeof generateAndUploadImage>(
    runId ?? undefined,
    {
      accessToken: publicAccessToken ?? "",
      enabled: Boolean(runId && publicAccessToken),
    }
  );

  // Handle run completion
  useEffect(() => {
    if (run?.status === "COMPLETED") {
      // Extract generated image URL
      let publicUrl = run.output?.publicUrl;
      if (!publicUrl && run.metadata?.result) {
        const result = run.metadata.result as any;
        publicUrl = result.publicUrl;
      }

      if (publicUrl && publicUrl !== generatedImageUrl) {
        setGeneratedImageUrl(publicUrl);
        setIsGenerating(false);
        setIsRegenerating(false);
      }

      // Notify parent
      if (run?.id && onGenerationComplete) {
        onGenerationComplete(run.id, customPrompt, publicUrl);
      }
    } else if (run?.status === "FAILED") {
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  }, [
    run?.status,
    run?.output,
    run?.metadata,
    run?.id,
    onGenerationComplete,
    customPrompt,
    generatedImageUrl,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    try {
      setIsGenerating(true);

      const result = await triggerGenerationTask({
        promptStyle: "custom",
        baseImageUrl,
        productAnalysis,
        customPrompt: customPrompt.trim(),
        size: "1024x1792",
      });

      if (result.success) {
        setRunId(result.runId);
        setPublicAccessToken(result.publicAccessToken);
      } else {
        console.error("Generation failed:", result.error);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error("Failed to generate custom image:", error);
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    try {
      setIsRegenerating(true);
      setIsGenerating(true);
      setRunId(null);
      setPublicAccessToken(null);

      const result = await triggerGenerationTask({
        promptStyle: "custom",
        baseImageUrl,
        productAnalysis,
        customPrompt: customPrompt.trim(),
        size: "1024x1792",
      });

      if (result.success) {
        setRunId(result.runId);
        setPublicAccessToken(result.publicAccessToken);
      } else {
        console.error("Generation failed:", result.error);
        setIsGenerating(false);
        setIsRegenerating(false);
      }
    } catch (error) {
      console.error("Failed to regenerate custom image:", error);
      setIsGenerating(false);
      setIsRegenerating(false);
    }
  };

  const isDisabled =
    !baseImageUrl || !productAnalysis || !customPrompt.trim() || isGenerating;

  const handleDownload = () => {
    if (generatedImageUrl) {
      const link = document.createElement("a");
      link.href = generatedImageUrl;
      link.download = `custom-generated-${Date.now()}.png`;
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

  const handleReset = () => {
    setGeneratedImageUrl(null);
    setCustomPrompt("");
    setRunId(null);
    setPublicAccessToken(null);
    setIsGenerating(false);
    setShowForm(false);
  };

  return (
    <Card
      className={`aspect-[3/4] ${
        generatedImageUrl
          ? "border transition-colors relative overflow-hidden group bg-card p-0"
          : "border transition-colors relative overflow-hidden group bg-card p-0"
      }`}
    >
      {generatedImageUrl ? (
        // Show generated image
        <div className="h-full w-full relative overflow-hidden rounded-lg">
          <img
            src={generatedImageUrl}
            alt="Custom generated image"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Regenerating overlay */}
          {isRegenerating && isGenerating && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-4 transition-colors ">
                  <div className="animate-spin rounded-full h-6 w-6">
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
              onClick={handleRegenerate}
              disabled={isRegenerating && isGenerating}
              title="Regenerate image"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleExpand}
              disabled={isRegenerating && isGenerating}
              title="View full size"
            >
              <Expand className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleDownload}
              disabled={isRegenerating && isGenerating}
              title="Download image"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-8 h-8 rounded-full p-0 backdrop-blur-sm bg-white/90 hover:bg-white"
              onClick={handleReset}
              disabled={isRegenerating && isGenerating}
              title="Create new image"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <p className="text-white text-sm font-medium drop-shadow-sm line-clamp-2">
              {customPrompt}
            </p>
          </div>
        </div>
      ) : showForm ? (
        // Show form
        <div className="h-full flex flex-col p-4">
          <div className="flex-1 flex flex-col justify-center">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="custom-prompt"
                  className="block text-sm font-medium text-foreground mb-4"
                >
                  Add another product shot
                </label>
                <textarea
                  id="custom-prompt"
                  placeholder="e.g. 'product being used by someone outdoors'"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isGenerating}
                  className="w-full h-20 px-3 text-sm border border-input bg-transparent rounded-md shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  rows={3}
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isDisabled || isGenerating}
                  className="flex-1 gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {!baseImageUrl && (
            <div className="text-center text-sm text-muted-foreground">
              Upload an image first to enable custom prompts
            </div>
          )}
        </div>
      ) : (
        // Show blank state (same as GeneratedCard but no text)
        <div
          onClick={!baseImageUrl ? undefined : () => setShowForm(true)}
          className={`h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-gray-50/50 transition-colors ${
            !baseImageUrl ? "pointer-events-none" : ""
          }`}
        >
          <div className="w-12 h-12 rounded-lg bg-gray-300/20 flex items-center justify-center mb-4">
            {isGenerating ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            ) : baseImageUrl && productAnalysis ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {isGenerating
              ? "Generating..."
              : baseImageUrl && productAnalysis
              ? "Click to add custom shot"
              : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
