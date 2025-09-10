"use client";

import { useState } from "react";
import { Home, ImageIcon, Settings, Upload, User } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import UploadCard from "./components/UploadCard";
import GeneratedCard from "./components/GeneratedCard";
import CustomPromptCard from "./components/CustomPromptCard";
import type { ProductAnalysis } from "./types/trigger";

export default function ProductImageGenerator() {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [productAnalysis, setProductAnalysis] =
    useState<ProductAnalysis | null>(null);

  // Track custom generations for bottom row
  const [customGenerations, setCustomGenerations] = useState<{
    runIds: (string | null)[];
    prompts: (string | null)[];
  }>({
    runIds: [null, null, null, null],
    prompts: [null, null, null, null],
  });

  const handleUploadComplete = (
    imageUrl: string,
    productAnalysis?: ProductAnalysis
  ) => {
    setUploadedImageUrl(imageUrl);
    if (productAnalysis) {
      setProductAnalysis(productAnalysis);
    }
  };

  const handleCustomGenerationComplete = (
    runId: string,
    prompt: string,
    index: number
  ) => {
    setCustomGenerations((prev) => ({
      runIds: prev.runIds.map((id, i) => (i === index ? runId : id)),
      prompts: prev.prompts.map((p, i) => (i === index ? prompt : p)),
    }));
  };

  const promptTitles = {
    "isolated-table": "Clean Product Shot",
    "lifestyle-scene": "Lifestyle Scene",
    "hero-shot": "Hero Shot",
  };

  // Determine which custom cards have completed generations
  const completedCustomCards = customGenerations.runIds.filter(
    (runId) => runId !== null
  ).length;

  // Find the next available custom card slot
  const nextCustomCardIndex = customGenerations.runIds.findIndex(
    (runId) => runId === null
  );

  // Check if top row is complete (upload + 3 generated images)
  const topRowGenerationsComplete =
    uploadedImageUrl && productAnalysis ? true : false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Product Image Generator
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Upload a product image and generate professional marketing
                    shots
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Account
                </Button>
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </div>
            </div>
          </div>

          {/* Top Row - Upload + 3 Generated Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Upload card stays square */}
            <UploadCard onUploadComplete={handleUploadComplete} />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="isolated-table"
              promptTitle={promptTitles["isolated-table"]}
            />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="lifestyle-scene"
              promptTitle={promptTitles["lifestyle-scene"]}
            />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="hero-shot"
              promptTitle={promptTitles["hero-shot"]}
            />
          </div>

          {/* Bottom Row - Sequential Custom Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => {
              // If there's a completed custom generation for this slot, show it
              const runId = customGenerations.runIds[index];
              const customPrompt = customGenerations.prompts[index];

              if (runId && customPrompt) {
                return (
                  <Card
                    key={`custom-result-${index}`}
                    className="aspect-[3/4] border transition-colors relative overflow-hidden group bg-card p-0"
                  >
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <h3 className="font-medium text-sm mb-2">Custom Scene</h3>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {customPrompt}
                      </p>
                    </div>
                  </Card>
                );
              }

              // If this is the next available slot and top row is complete, show custom prompt card
              if (index === nextCustomCardIndex && topRowGenerationsComplete) {
                return (
                  <CustomPromptCard
                    key={`custom-prompt-${index}`}
                    baseImageUrl={uploadedImageUrl}
                    productAnalysis={productAnalysis}
                    onGenerationComplete={(runId, prompt) =>
                      handleCustomGenerationComplete(runId, prompt, index)
                    }
                  />
                );
              }

              // Otherwise show placeholder
              return (
                <Card
                  key={`placeholder-${index}`}
                  className="aspect-[3/4] border-2 border-dashed border-muted bg-muted/20"
                >
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <span className="text-lg font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {!topRowGenerationsComplete
                        ? "Complete upload and generation first"
                        : index === 0
                        ? "Ready for custom prompt"
                        : `Slot ${index + 1}`}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Powered by{" "}
              <span className="font-medium text-primary">Trigger.dev</span> and{" "}
              <span className="font-medium text-primary">Flux AI</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
