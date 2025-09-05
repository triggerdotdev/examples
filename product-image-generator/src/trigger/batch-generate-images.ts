import { logger, metadata, task } from "@trigger.dev/sdk";
import { generateProductImage } from "./generate-image";

export const batchGenerateProductImages = task({
  id: "batch-generate-product-images",
  maxDuration: 900, // 15 minutes max for all 3 images
  run: async (payload: {
    baseImageUrl: string;
    productDescription?: string;
  }) => {
    const { baseImageUrl, productDescription = "product" } = payload;

    // Set initial metadata
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 4,
      message: "Preparing batch image generation...",
    });

    logger.log("Starting batch image generation", {
      baseImageUrl,
      productDescription,
    });

    // Define the 3 marketing prompts - emphasizing exact product replication
    const prompts = [
      {
        id: "isolated-table",
        prompt:
          `Create a professional product photography shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Place this identical product isolated on a clean white table surface with studio lighting, minimalist background, commercial photography style, high resolution, sharp focus. The product must look exactly the same as in the reference image.`,
      },
      {
        id: "lifestyle-scene",
        prompt:
          `Create a lifestyle product photography shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Place this identical product in a modern home setting with natural lighting, styled environment, aspirational lifestyle, professional commercial photography. The product must look exactly the same as in the reference image, only the background and setting should change.`,
      },
      {
        id: "hero-shot",
        prompt:
          `Create a hero product shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Present this identical product with dramatic lighting, premium presentation, luxury commercial photography style, perfect for marketing materials, high-end aesthetic. The product must look exactly the same as in the reference image, only the lighting and presentation should be enhanced.`,
      },
    ];

    try {
      // Update progress
      metadata.set("progress", {
        step: 2,
        total: 4,
        message: "Triggering image generation tasks...",
      });

      // Trigger all 3 image generation tasks in parallel
      const generationPromises = prompts.map(async ({ id, prompt }) => {
        logger.log(`Triggering generation for ${id}`, { prompt });

        try {
          const result = await generateProductImage.trigger({
            prompt,
            baseImageUrl,
            model: "dall-e-3",
            size: "1024x1792", // Portrait format for better slot fitting
          });

          return {
            id,
            success: true,
            runId: result.id,
            prompt,
          };
        } catch (error) {
          logger.error(`Failed to trigger generation for ${id}`, { error });
          return {
            id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            prompt,
          };
        }
      });

      // Wait for all triggers to complete
      metadata.set("progress", {
        step: 3,
        total: 4,
        message: "All generation tasks triggered, monitoring progress...",
      });

      const results = await Promise.all(generationPromises);

      // Update progress
      metadata.set("progress", {
        step: 4,
        total: 4,
        message: "Batch generation initiated successfully!",
      });
      metadata.set("status", "completed");

      // Set final metadata with results
      metadata.set("result", {
        baseImageUrl,
        productDescription,
        generations: results,
        totalTasks: results.length,
        successfulTasks: results.filter((r) => r.success).length,
        failedTasks: results.filter((r) => !r.success).length,
      });

      logger.log("Batch generation completed", {
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });

      return {
        success: true,
        baseImageUrl,
        productDescription,
        generations: results,
        totalTasks: results.length,
        successfulTasks: results.filter((r) => r.success).length,
        failedTasks: results.filter((r) => !r.success).length,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", {
        step: 0,
        total: 4,
        message: "Batch generation failed",
      });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("Failed to complete batch generation", {
        error,
        baseImageUrl,
      });
      throw error;
    }
  },
});
