"use client";

import { useState } from "react";
import { Home, ImageIcon, Settings, Upload, User } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import UploadCard from "./components/UploadCard";
import GeneratedCard from "./components/GeneratedCard";
import CustomPromptCard from "./components/CustomPromptCard";
import { generateSingleImageAction } from "./actions";

export default function ImageManagementApp() {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [productAnalysis, setProductAnalysis] = useState<any>(null);
  const [generationRunIds, setGenerationRunIds] = useState<{
    [key: string]: string | null;
  }>({
    "isolated-table": null,
    "lifestyle-scene": null,
    "hero-shot": null,
  });
  const [generationAccessTokens, setGenerationAccessTokens] = useState<{
    [key: string]: string | null;
  }>({
    "isolated-table": null,
    "lifestyle-scene": null,
    "hero-shot": null,
    custom: null,
  });

  // Track custom generations for bottom row
  const [customGenerations, setCustomGenerations] = useState<{
    runIds: (string | null)[];
    accessTokens: (string | null)[];
    prompts: (string | null)[];
  }>({
    runIds: [null, null, null],
    accessTokens: [null, null, null],
    prompts: [null, null, null],
  });

  const promptTitles = {
    "isolated-table": "Table Shot",
    "lifestyle-scene": "Lifestyle Scene",
    "hero-shot": "Hero Shot",
    custom: "Custom Prompt",
  };

  const handleUploadComplete = async (imageUrl: string, analysis?: any) => {
    try {
      // Store the uploaded image URL and analysis for retries
      setUploadedImageUrl(imageUrl);
      setProductAnalysis(analysis);

      // Only trigger generations if we have product analysis
      if (!analysis) {
        console.error("No product analysis available");
        return;
      }

      // Trigger all 3 generations individually for better progress tracking
      const promptIds = ["isolated-table", "lifestyle-scene", "hero-shot"];

      for (const promptId of promptIds) {
        const result = await generateSingleImageAction(
          imageUrl,
          analysis,
          promptId
        );

        if (result.success) {
          console.log(`Successfully triggered generation for ${promptId}:`, {
            runId: result.runId,
            hasAccessToken: !!result.accessToken,
          });
          setGenerationRunIds((prev) => ({
            ...prev,
            [promptId]: result.runId,
          }));
          setGenerationAccessTokens((prev) => ({
            ...prev,
            [promptId]: result.accessToken,
          }));
        } else {
          console.error(
            `Failed to start generation for ${promptId}:`,
            result.error
          );
        }
      }
    } catch (error) {
      console.error("Failed to start image generations:", error);
    }
  };

  const handleRetryGeneration = async (promptId: string) => {
    if (!uploadedImageUrl || !productAnalysis) {
      console.error(
        "No base image URL or product analysis available for retry"
      );
      return;
    }

    try {
      // Reset the specific generation
      setGenerationRunIds((prev) => ({ ...prev, [promptId]: null }));
      setGenerationAccessTokens((prev) => ({ ...prev, [promptId]: null }));

      // Trigger the specific generation again with product analysis
      const result = await generateSingleImageAction(
        uploadedImageUrl,
        productAnalysis,
        promptId
      );

      if (result.success) {
        setGenerationRunIds((prev) => ({ ...prev, [promptId]: result.runId }));
        setGenerationAccessTokens((prev) => ({
          ...prev,
          [promptId]: result.accessToken,
        }));
      } else {
        console.error(
          `Failed to retry generation for ${promptId}:`,
          result.error
        );
      }
    } catch (error) {
      console.error(`Failed to retry generation for ${promptId}:`, error);
    }
  };

  const handleCustomGenerationComplete = (
    runId: string,
    accessToken: string,
    prompt: string,
    cardIndex: number
  ) => {
    setCustomGenerations((prev) => ({
      runIds: prev.runIds.map((id, i) => (i === cardIndex ? runId : id)),
      accessTokens: prev.accessTokens.map((token, i) =>
        i === cardIndex ? accessToken : token
      ),
      prompts: prev.prompts.map((p, i) => (i === cardIndex ? prompt : p)),
    }));
  };

  // Check if top row generations are complete
  const topRowGenerationsComplete =
    generationRunIds["isolated-table"] &&
    generationRunIds["lifestyle-scene"] &&
    generationRunIds["hero-shot"];

  // Find next available custom card slot
  const getNextCustomCardIndex = () => {
    return customGenerations.runIds.findIndex((id) => id === null);
  };

  const nextCustomCardIndex = getNextCustomCardIndex();
  const hasAvailableCustomSlot = nextCustomCardIndex !== -1;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ">
        <div className="flex h-16 items-center justify-between px-6 w-full">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-primary font-[family-name:var(--font-playfair)]">
              ImageFlow
            </h1>
            <nav className="hidden md:flex items-center gap-6">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                Home
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                My Images
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-8">
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-6 py-8 flex flex-col items-center justify-center max-w-7xl mx-auto my-auto h-screen">
        <div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2 font-[family-name:var(--font-playfair)]">
              Product Image Generator
            </h2>
            <p className="text-muted-foreground">
              Upload a product image and automatically generate professional
              marketing shots
            </p>
          </div>

          {/* Top Row - Upload + 3 Generated Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Upload card stays square */}
            <UploadCard onUploadComplete={handleUploadComplete} />
            <GeneratedCard
              runId={generationRunIds["isolated-table"]}
              accessToken={generationAccessTokens["isolated-table"]}
              promptId="isolated-table"
              promptTitle={promptTitles["isolated-table"]}
              onRetry={() => handleRetryGeneration("isolated-table")}
            />
            <GeneratedCard
              runId={generationRunIds["lifestyle-scene"]}
              accessToken={generationAccessTokens["lifestyle-scene"]}
              promptId="lifestyle-scene"
              promptTitle={promptTitles["lifestyle-scene"]}
              onRetry={() => handleRetryGeneration("lifestyle-scene")}
            />
            <GeneratedCard
              runId={generationRunIds["hero-shot"]}
              accessToken={generationAccessTokens["hero-shot"]}
              promptId="hero-shot"
              promptTitle={promptTitles["hero-shot"]}
              onRetry={() => handleRetryGeneration("hero-shot")}
            />
          </div>

          {/* Bottom Row - Sequential Custom Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => {
              const runId = customGenerations.runIds[index];
              const accessToken = customGenerations.accessTokens[index];
              const prompt = customGenerations.prompts[index];

              // If this slot has a generation, show the generated card
              if (runId && accessToken) {
                return (
                  <GeneratedCard
                    key={`custom-${index}`}
                    runId={runId}
                    accessToken={accessToken}
                    promptId={`custom-${index}`}
                    promptTitle={prompt || "Custom Scenario"}
                    onRetry={() => {
                      // Reset this specific custom generation
                      setCustomGenerations((prev) => ({
                        runIds: prev.runIds.map((id, i) =>
                          i === index ? null : id
                        ),
                        accessTokens: prev.accessTokens.map((token, i) =>
                          i === index ? null : token
                        ),
                        prompts: prev.prompts.map((p, i) =>
                          i === index ? null : p
                        ),
                      }));
                    }}
                  />
                );
              }

              // If this is the next available slot and top row is complete, show custom prompt card
              if (index === nextCustomCardIndex && topRowGenerationsComplete) {
                return (
                  <CustomPromptCard
                    key={`custom-prompt-${index}`}
                    baseImageUrl={uploadedImageUrl}
                    productAnalysis={productAnalysis}
                    onGenerationComplete={(runId, accessToken, prompt) =>
                      handleCustomGenerationComplete(
                        runId,
                        accessToken,
                        prompt,
                        index
                      )
                    }
                  />
                );
              }

              // Otherwise show placeholder
              return (
                <Card
                  key={`placeholder-${index}`}
                  className="aspect-[3/4] bg-card border border-muted-foreground/25"
                >
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-lg bg-gray-300/20 flex items-center justify-center mx-auto mb-2">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {topRowGenerationsComplete
                          ? "Create custom scenario"
                          : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload New Image
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
