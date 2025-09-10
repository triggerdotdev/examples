"use client";

import { useTaskTrigger, useRealtimeRun } from "@trigger.dev/react-hooks";
import { RefreshCw, Send } from "lucide-react";
import { useState, useEffect } from "react";
import type { generateAndUploadImage } from "../../src/trigger/generate-and-upload-image";
import type { ProductAnalysis } from "../types/trigger";

type TaskRun = {
  id?: string;
  status?: string;
  output?: unknown;
  metadata?: unknown;
};
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface CustomPromptCardProps {
  triggerToken: string;
  baseImageUrl: string | null;
  productAnalysis: ProductAnalysis | null;
  onGenerationComplete?: (
    runId: string,
    accessToken: string,
    prompt: string
  ) => void;
}

export default function CustomPromptCard({
  triggerToken,
  baseImageUrl,
  productAnalysis,
  onGenerationComplete,
}: CustomPromptCardProps) {
  const [customPrompt, setCustomPrompt] = useState("");

  // Use task trigger hook for generation
  const { submit, handle, error, isLoading } = useTaskTrigger<
    typeof generateAndUploadImage
  >("generate-and-upload-image", {
    accessToken: triggerToken,
  });

  // Subscribe to the run using the handle's public access token
  const { run, error: realtimeError } = useRealtimeRun<
    typeof generateAndUploadImage
  >(handle?.id, {
    accessToken: handle?.publicAccessToken,
    enabled: !!handle,
  });

  // Notify parent when generation completes
  if (run?.status === "COMPLETED" && run.id && onGenerationComplete) {
    onGenerationComplete(run.id, triggerToken ?? "", customPrompt);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    if (!triggerToken) {
      console.error("Access token not available");
      return;
    }

    try {
      submit({
        promptStyle: "custom",
        baseImageUrl,
        productAnalysis,
        customPrompt: customPrompt.trim(),
        model: "flux",
        size: "1024x1024",
      });
    } catch (error) {
      console.error("Failed to generate custom image:", error);
    }
  };

  const handleRegenerate = async () => {
    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    if (!triggerToken) {
      console.error("Access token not available");
      return;
    }

    try {
      submit({
        promptStyle: "custom",
        baseImageUrl,
        productAnalysis,
        customPrompt: customPrompt.trim(),
        model: "flux",
        size: "1024x1024",
      });
    } catch (error) {
      console.error("Failed to regenerate custom image:", error);
    }
  };

  const isDisabled = !baseImageUrl || !productAnalysis || !customPrompt.trim();

  return (
    <Card className="aspect-[3/4] border-2 border-dashed border-primary/30 bg-card">
      <div className="h-full flex flex-col p-4">
        <div className="flex-1 flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="custom-prompt"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Create a scenario with this product
              </label>
              <textarea
                id="custom-prompt"
                placeholder="Describe a scene or setting for this product (e.g., 'product on a wooden table with natural lighting in a modern kitchen', 'product being used by someone outdoors', 'product in a luxury bathroom setting')"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={isLoading}
                className="w-full h-20 px-3 py-2 text-sm border border-input bg-transparent rounded-md shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isDisabled || isLoading}
                className="flex-1 gap-2"
              >
                {isLoading ? (
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

              {run?.id && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isDisabled || isLoading}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              )}
            </div>
          </form>
        </div>

        {!baseImageUrl && (
          <div className="text-center text-sm text-muted-foreground">
            Upload an image first to enable custom prompts
          </div>
        )}
      </div>
    </Card>
  );
}
