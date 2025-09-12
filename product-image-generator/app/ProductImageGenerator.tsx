"use client";

import { Download, Home, Settings, User, WandSparklesIcon } from "lucide-react";
import { useState } from "react";
import CustomPromptCard from "./components/CustomPromptCard";
import GeneratedCard from "./components/GeneratedCard";
import { Button } from "./components/ui/button";
import UploadCard from "./components/UploadCard";
import type { ProductAnalysis } from "./types/trigger";
import { useSearchParams } from "next/navigation";

const promptTitles = {
  "isolated-table": "Clean Product Shot",
  "lifestyle-scene": "Lifestyle Scene",
  "hero-shot": "Hero Shot",
};

export default function ProductImageGenerator() {
  const searchParams = useSearchParams();
  const publicAccessToken = searchParams.get("publicAccessToken");
  const fileUrl = searchParams.get("fileUrl");

  // Calculate total generated images
  const totalGeneratedImages = Object.keys(generatedImages).length;
  const hasGeneratedImages = totalGeneratedImages > 0;

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
    <div className="min-h-screen bg-gray-100/20 ">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <WandSparklesIcon className="h-5 w-5 text-purple-500" />
                <h1 className="text-xl font-bold text-foreground">ImageFlow</h1>
              </div>
            </div>

            <nav className="flex items-center space-x-1">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-1 text-gray-500" />
                Home
              </Button>
              <Button variant="ghost" size="sm">
                <User className="h-4 w-4 mr-1 text-gray-500" />
                Account
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-1 text-gray-500" />
                Settings
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container px-4 py-16 w-full mx-auto ">
        <div className="max-w-7xl mx-auto w">
          <div className="mb-8 flex justify-between items-end gap-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Product Image Generator
              </h2>
              <p className="text-muted-foreground">
                Upload a product image and generate professional marketing shots
                for your online store.
              </p>
            </div>
            <div>
              <Button
                variant={hasGeneratedImages ? "default" : "outline"}
                disabled={!hasGeneratedImages}
                onClick={handleDownloadAll}
                className={
                  !hasGeneratedImages
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }
              >
                <Download className="h-4 w-4 mr-1" />
                {hasGeneratedImages
                  ? `Download ${totalGeneratedImages} image${
                      totalGeneratedImages === 1 ? "" : "s"
                    } `
                  : "Download images"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <UploadCard />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="isolated-table"
              promptTitle={promptTitles["isolated-table"]}
              onGenerationComplete={handlePresetGenerationComplete}
            />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="lifestyle-scene"
              promptTitle={promptTitles["lifestyle-scene"]}
              onGenerationComplete={handlePresetGenerationComplete}
            />
            <GeneratedCard
              baseImageUrl={uploadedImageUrl}
              productAnalysis={productAnalysis}
              promptId="hero-shot"
              promptTitle={promptTitles["hero-shot"]}
              onGenerationComplete={handlePresetGenerationComplete}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => {
              return (
                <CustomPromptCard
                  key={`custom-prompt-${index}`}
                  baseImageUrl={uploadedImageUrl}
                  productAnalysis={productAnalysis}
                  onGenerationComplete={(runId, prompt, imageUrl) =>
                    handleCustomGenerationComplete(
                      runId,
                      prompt,
                      index,
                      imageUrl
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
