"use client";

import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { generateCustomImageAction } from "../actions";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface CustomPromptCardProps {
  baseImageUrl: string | null;
  productAnalysis: any | null;
  onGenerationComplete?: (
    runId: string,
    accessToken: string,
    prompt: string
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
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateCustomImageAction(
        baseImageUrl,
        productAnalysis,
        customPrompt.trim()
      );

      if (result.success) {
        setRunId(result.runId);
        setAccessToken(result.accessToken);
        onGenerationComplete?.(
          result.runId,
          result.accessToken,
          customPrompt.trim()
        );
      }
    } catch (error) {
      console.error("Failed to generate custom image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!customPrompt.trim() || !baseImageUrl || !productAnalysis) {
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateCustomImageAction(
        baseImageUrl,
        productAnalysis,
        customPrompt.trim()
      );

      if (result.success) {
        setRunId(result.runId);
        setAccessToken(result.accessToken);
        onGenerationComplete?.(
          result.runId,
          result.accessToken,
          customPrompt.trim()
        );
      }
    } catch (error) {
      console.error("Failed to regenerate custom image:", error);
    } finally {
      setIsGenerating(false);
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
                disabled={isGenerating}
                className="w-full h-20 px-3 py-2 text-sm border border-input bg-transparent rounded-md shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                rows={3}
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

              {runId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isDisabled || isGenerating}
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
