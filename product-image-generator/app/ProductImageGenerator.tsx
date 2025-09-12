"use client";

import {
  Download,
  Home,
  ImageIcon,
  Settings,
  User,
  WandSparklesIcon,
} from "lucide-react";
import { useState } from "react";
import CustomPromptCard from "./components/CustomPromptCard";
import GeneratedCard from "./components/GeneratedCard";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import UploadCard from "./components/UploadCard";
import type { ProductAnalysis } from "./types/trigger";

interface ProductImageGeneratorProps {
  triggerToken: string;
}

export default function ProductImageGenerator({
  triggerToken,
}: ProductImageGeneratorProps) {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [productAnalysis, setProductAnalysis] =
    useState<ProductAnalysis | null>(null);

  // Track all generated images
  const [generatedImages, setGeneratedImages] = useState<{
    [key: string]: { runId: string; prompt: string; imageUrl?: string };
  }>({});

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

  const handleGenerationComplete = (
    runId: string,
    prompt: string,
    imageUrl?: string,
    key?: string
  ) => {
    console.log("Generation completed:", { runId, prompt, imageUrl, key });
    setGeneratedImages((prev) => {
      const updated = {
        ...prev,
        [key || runId]: { runId, prompt, imageUrl },
      };
      console.log("Updated generated images:", updated);
      return updated;
    });
  };

  const handleCustomGenerationComplete = (
    runId: string,
    prompt: string,
    index: number,
    imageUrl?: string
  ) => {
    setCustomGenerations((prev) => ({
      runIds: prev.runIds.map((id, i) => (i === index ? runId : id)),
      prompts: prev.prompts.map((p, i) => (i === index ? prompt : p)),
    }));
    handleGenerationComplete(runId, prompt, imageUrl, `custom-${index}`);
  };

  const handlePresetGenerationComplete = (
    runId: string,
    promptId: string,
    promptTitle: string,
    imageUrl?: string
  ) => {
    handleGenerationComplete(runId, promptTitle, imageUrl, promptId);
  };

  const handleDownloadAll = async () => {
    console.log("Download button clicked!");
    console.log("Generated images:", generatedImages);
    console.log("Total generated images:", totalGeneratedImages);

    if (totalGeneratedImages === 0) {
      console.log("No images to download");
      return;
    }

    try {
      // For a single image, download directly
      if (totalGeneratedImages === 1) {
        const imageData = Object.values(generatedImages)[0];
        console.log("Single image data:", imageData);

        if (imageData.imageUrl) {
          console.log("Downloading single image:", imageData.imageUrl);

          // Try to fetch the image first to handle CORS
          try {
            const response = await fetch(imageData.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `${imageData.prompt
              .replace(/\s+/g, "-")
              .toLowerCase()}-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(url);
          } catch (fetchError) {
            console.log("Fetch failed, trying direct download:", fetchError);
            // Fallback to direct download
            const link = document.createElement("a");
            link.href = imageData.imageUrl;
            link.download = `${imageData.prompt
              .replace(/\s+/g, "-")
              .toLowerCase()}-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } else {
          console.log("No image URL found for single image");
        }
        return;
      }

      // For multiple images, download each individually
      console.log("Downloading multiple images...");
      Object.entries(generatedImages).forEach(([key, imageData], index) => {
        console.log(`Image ${index + 1}:`, key, imageData);

        if (imageData.imageUrl) {
          setTimeout(async () => {
            try {
              console.log(
                `Downloading image ${index + 1}:`,
                imageData.imageUrl
              );

              // Try to fetch the image first to handle CORS
              const response = await fetch(imageData.imageUrl!);
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);

              const link = document.createElement("a");
              link.href = url;
              link.download = `${imageData.prompt
                .replace(/\s+/g, "-")
                .toLowerCase()}-${Date.now()}-${index + 1}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              // Clean up the blob URL
              window.URL.revokeObjectURL(url);
            } catch (fetchError) {
              console.log(
                `Fetch failed for image ${index + 1}, trying direct download:`,
                fetchError
              );
              // Fallback to direct download
              const link = document.createElement("a");
              link.href = imageData.imageUrl!;
              link.download = `${imageData.prompt
                .replace(/\s+/g, "-")
                .toLowerCase()}-${Date.now()}-${index + 1}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }, index * 1000); // Stagger downloads by 1 second
        } else {
          console.log(`No image URL found for image ${index + 1}`);
        }
      });
    } catch (error) {
      console.error("Failed to download images:", error);
    }
  };

  const promptTitles = {
    "isolated-table": "Clean Product Shot",
    "lifestyle-scene": "Lifestyle Scene",
    "hero-shot": "Hero Shot",
  };

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
            <UploadCard
              triggerToken={triggerToken}
              onUploadComplete={handleUploadComplete}
            />
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
