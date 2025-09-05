import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logger, metadata, task } from "@trigger.dev/sdk";
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

export const uploadImageToR2 = task({
  id: "upload-image-to-r2",
  maxDuration: 300, // 5 minutes max
  run: async (payload: {
    imageBuffer: string; // base64 encoded image
    fileName: string;
    contentType: string;
  }) => {
    const { imageBuffer, fileName, contentType } = payload;

    // Set initial metadata
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 4,
      message: "Preparing upload...",
    });

    logger.log("Starting image upload to R2", { fileName, contentType });

    // Convert base64 to buffer
    metadata.set("progress", {
      step: 2,
      total: 4,
      message: "Processing image data...",
    });
    const buffer = Buffer.from(imageBuffer, "base64");
    const fileSize = buffer.length;

    logger.log(`Image size: ${fileSize} bytes`);

    // Generate unique key for R2
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const r2Key = `uploaded-images/${timestamp}-${sanitizedFileName}`;

    metadata.set("progress", {
      step: 3,
      total: 4,
      message: "Uploading to storage...",
    });

    const uploadParams = {
      Bucket: process.env.R2_BUCKET,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
      // Add cache control for better performance
      CacheControl: "public, max-age=31536000", // 1 year
    };

    try {
      // Upload to R2
      logger.log("About to upload to R2", {
        bucket: process.env.R2_BUCKET,
        endpoint: process.env.R2_ENDPOINT,
        r2Key,
        fileSize,
        hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      });

      const result = await s3Client.send(new PutObjectCommand(uploadParams));
      logger.log("S3 PutObject response:", result as any);
      logger.log(`Image uploaded successfully to R2`, { r2Key });

      // Update metadata for completion
      metadata.set("progress", {
        step: 4,
        total: 4,
        message: "Upload completed!",
      });
      metadata.set("status", "completed");

      // Construct the public URL using the R2_PUBLIC_URL env var
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

      // Set final metadata with result
      metadata.set("result", {
        publicUrl,
        r2Key,
        fileSize,
        fileName: sanitizedFileName,
      });

      return {
        success: true,
        bucket: process.env.R2_BUCKET,
        r2Key,
        publicUrl,
        fileSize,
        contentType,
        fileName: sanitizedFileName,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", { step: 0, total: 4, message: "Upload failed" });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("Failed to upload image to R2", { error, r2Key });
      throw error;
    }
  },
});
