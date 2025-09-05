import { experimental_generateImage } from "ai";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { openai } from "@ai-sdk/openai";
import { uploadImageToR2 } from "./image-upload";

export const generateProductImage = task({
  id: "generate-product-image",
  maxDuration: 600, // 10 minutes max (includes upload time)
  run: async (payload: {
    prompt: string;
    model?: "dall-e-2" | "dall-e-3";
    size?: "1024x1024" | "1792x1024" | "1024x1792";
    baseImageUrl?: string; // For creating derivatives
  }) => {
    const {
      prompt,
      model = "dall-e-3",
      size = "1024x1024",
      baseImageUrl,
    } = payload;

    // Set initial metadata
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 4,
      message: "Preparing image generation...",
    });

    logger.log("Starting image generation", {
      prompt,
      model,
      size,
      baseImageUrl,
      isDerivative: !!baseImageUrl,
    });

    try {
      // Update progress
      metadata.set("progress", {
        step: 2,
        total: 4,
        message: "Generating image with AI...",
      });

      // Generate the image using AI SDK
      const generateParams: any = {
        model: openai.image(model),
        prompt: baseImageUrl
          ? `${prompt}. Base this on the product shown in this reference image: ${baseImageUrl}`
          : prompt,
        size,
      };

      // Add image reference if provided (for derivatives)
      if (baseImageUrl) {
        generateParams.prompt =
          `Create a professional marketing image: ${prompt}. Use the product from this reference image: ${baseImageUrl}. Maintain the product's key features and characteristics while adapting it to the new scenario.`;
      }

      const { image } = await experimental_generateImage(generateParams);

      logger.log("Image generated successfully");

      // Update progress
      metadata.set("progress", {
        step: 3,
        total: 4,
        message: "Uploading generated image...",
      });

      // Convert the image to base64 and upload to R2
      const imageBuffer = Buffer.from(image.uint8Array);
      const base64Image = imageBuffer.toString("base64");

      // Generate a filename for the generated image
      const timestamp = Date.now();
      const filename = baseImageUrl
        ? `generated-derivative-${timestamp}.png`
        : `generated-${timestamp}.png`;

      // Upload the generated image to R2 and wait for completion
      const uploadResult = await uploadImageToR2.triggerAndWait({
        imageBuffer: base64Image,
        fileName: filename,
        contentType: "image/png",
      });

      if (!uploadResult.ok) {
        throw new Error(`Image upload failed: ${uploadResult.error}`);
      }

      const uploadOutput = uploadResult.output;

      // Log the upload completion
      logger.log("Upload task completed successfully");

      // Update final progress
      metadata.set("progress", {
        step: 4,
        total: 4,
        message: "Generation and upload completed!",
      });
      metadata.set("status", "completed");

      // Set final metadata with result
      metadata.set("result", {
        prompt,
        model,
        size,
        imageSize: imageBuffer.length,
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
      });

      return {
        success: true,
        imageBuffer: base64Image,
        imageSize: imageBuffer.length,
        contentType: "image/png",
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
        // Note: We don't include uploadRunId since we're using triggerAndWait
        model,
        size,
        prompt,
        baseImageUrl,
        isDerivative: !!baseImageUrl,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", {
        step: 0,
        total: 4,
        message: "Generation failed",
      });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("Failed to generate image", { error, prompt });
      throw error;
    }
  },
});
