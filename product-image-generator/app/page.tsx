"use client";

import { useState } from "react";
import { Home, ImageIcon, Settings, Upload, User } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import UploadCard from "./components/UploadCard";
import GeneratedCard from "./components/GeneratedCard";
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
  });

  const promptTitles = {
    "isolated-table": "Table Shot",
    "lifestyle-scene": "Lifestyle Scene",
    "hero-shot": "Hero Shot",
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
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
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </nav>
          </div>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-6 py-8">
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

        {/* Bottom Row - 4 More Cards (Future Implementation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={index + 4}
              className="aspect-[3/4] bg-card border border-dashed border-muted-foreground/25"
            >
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </div>
              </div>
            </Card>
          ))}
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
      </main>
    </div>
  );
}
