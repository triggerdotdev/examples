import { experimental_generateImage } from "ai";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { openai } from "@ai-sdk/openai";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Buffer } from "buffer";

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const generateAndUploadImage = task({
  id: "generate-and-upload-image",
  maxDuration: 600, // 10 minutes max
  run: async (payload: {
    prompt: string;
    baseImageUrl: string;
    model?: "dall-e-2" | "dall-e-3";
    size?: "1024x1024" | "1792x1024" | "1024x1792";
  }) => {
    const {
      prompt,
      baseImageUrl,
      model = "dall-e-3",
      size = "1024x1792",
    } = payload;

    // Set initial metadata with 5 steps total
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 5,
      message: "Preparing image generation...",
    });

    logger.log("Starting image generation and upload", {
      prompt,
      baseImageUrl,
      model,
      size,
    });

    try {
      // Step 2: Generate image
      metadata.set("progress", {
        step: 2,
        total: 5,
        message: "Generating image with AI...",
      });

      const generateParams: any = {
        model: openai.image(model),
        prompt:
          `Create a professional marketing image: ${prompt}. Use the product from this reference image: ${baseImageUrl}. Maintain the product's key features and characteristics while adapting it to the new scenario.`,
        size,
      };

      const { image } = await experimental_generateImage(generateParams);
      logger.log("Image generated successfully");

      // Step 3: Prepare for upload
      metadata.set("progress", {
        step: 3,
        total: 5,
        message: "Preparing image for upload...",
      });

      const imageBuffer = Buffer.from(image.uint8Array);
      const base64Image = imageBuffer.toString("base64");

      const timestamp = Date.now();
      const filename = `generated-${timestamp}.png`;

      // Step 4: Upload to storage
      metadata.set("progress", {
        step: 4,
        total: 5,
        message: "Uploading to storage...",
      });

      // Generate unique key for R2
      const sanitizedFileName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
      const r2Key = `uploaded-images/${timestamp}-${sanitizedFileName}`;

      const uploadParams = {
        Bucket: process.env.R2_BUCKET,
        Key: r2Key,
        Body: imageBuffer,
        ContentType: "image/png",
        // Add cache control for better performance
        CacheControl: "public, max-age=31536000", // 1 year
      };

      // Upload to R2
      logger.log("About to upload to R2", {
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT,
        r2Key,
        fileSize: imageBuffer.length,
        hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      });

      const result = await s3Client.send(new PutObjectCommand(uploadParams));
      logger.log("S3 PutObject response:", result as any);
      logger.log(`Image uploaded successfully to R2`, { r2Key });

      // Construct the public URL using the R2_PUBLIC_URL env var
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

      const uploadOutput = {
        publicUrl,
        r2Key,
        fileSize: imageBuffer.length,
        fileName: sanitizedFileName,
      };

      // Step 5: Complete
      metadata.set("progress", {
        step: 5,
        total: 5,
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
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
        imageSize: imageBuffer.length,
        contentType: "image/png",
        model,
        size,
        prompt,
        baseImageUrl,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", {
        step: 0,
        total: 5,
        message: "Generation and upload failed",
      });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("Failed to generate and upload image", { error, prompt });
      throw error;
    }
  },
});
