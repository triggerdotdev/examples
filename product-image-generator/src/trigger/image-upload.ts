import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logger, metadata, task } from "@trigger.dev/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Buffer } from "buffer";
import { z } from "zod";

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

// Define the product analysis schema
const productAnalysisSchema = z.object({
  exact_product_name: z.string().describe(
    "The exact brand name and product model/name as it appears on the packaging",
  ),
  model_number: z.string().describe(
    "The specific model number or identifier (e.g., Z fc, iPhone 15, etc.)",
  ),
  material: z.string().describe(
    "Primary material type (e.g., glass, plastic, metal, fabric, wood)",
  ),
  colors: z.array(z.string()).describe(
    "Array of colors present in the product",
  ),
  shape: z.string().describe("Detailed shape description"),
  size_proportions: z.string().describe(
    "Relative size and proportions description",
  ),
  functional_elements: z.array(z.string()).describe("List of functional parts"),
  surface_finish: z.string().describe(
    "Finish type (matte, glossy, textured, etc.)",
  ),
  text_branding: z.string().describe("Any visible text, logos, or branding"),
  unique_features: z.array(z.string()).describe(
    "Distinctive identifying characteristics",
  ),
  product_category: z.string().describe("What type of product this is"),
});

// Structured product analysis using AI SDK
async function analyzeProductStructured(imageUrl: string) {
  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: productAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this product image and extract detailed properties. Be extremely specific and detailed about materials, colors, shape, functional elements, and unique characteristics. This will be used to preserve exact product appearance in AI generation. Focus on: exact brand name and model number, specific colors and color combinations (including any two-tone or multi-color designs), precise shape and proportions, functional details, label design elements, text content, and any distinctive visual features that make this product unique. Pay special attention to color accuracy - note exact color names and combinations. Be extremely precise about every visual detail that makes this product identifiable.",
            },
            {
              type: "image",
              image: imageUrl,
            },
          ],
        },
      ],
    });

    logger.log("Product analysis completed", { analysis: result.object });
    return result.object;
  } catch (error) {
    logger.warn("Failed to analyze product", { error });
    // Return fallback structure
    return {
      exact_product_name: "unknown product",
      model_number: "unknown model",
      material: "unknown",
      colors: ["unknown"],
      shape: "product shape",
      size_proportions: "standard proportions",
      functional_elements: ["main body"],
      surface_finish: "standard finish",
      text_branding: "none visible",
      unique_features: ["distinctive product"],
      product_category: "general product",
    };
  }
}

export const uploadImageToR2 = task({
  id: "upload-image-to-r2",
  maxDuration: 300, // 5 minutes max
  run: async (payload: {
    imageBuffer: string; // base64 encoded image
    fileName: string;
    contentType: string;
  }) => {
    const { imageBuffer, fileName, contentType } = payload;

    // Set initial metadata with 5 steps (added analysis)
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 5,
      message: "Preparing upload and analysis...",
    });

    logger.log("Starting image upload and analysis", { fileName, contentType });

    // Convert base64 to buffer
    metadata.set("progress", {
      step: 2,
      total: 5,
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
      total: 5,
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

      // Construct the public URL using the R2_PUBLIC_URL env var
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

      // Step 4: Analyze product properties
      metadata.set("progress", {
        step: 4,
        total: 5,
        message: "Analyzing product properties...",
      });

      const productAnalysis = await analyzeProductStructured(publicUrl);
      logger.log("Product analysis completed", { productAnalysis });

      // Step 5: Complete
      metadata.set("progress", {
        step: 5,
        total: 5,
        message: "Upload and analysis completed!",
      });
      metadata.set("status", "completed");

      // Set final metadata with result including analysis
      metadata.set("result", {
        publicUrl,
        r2Key,
        fileSize,
        fileName: sanitizedFileName,
        productAnalysis,
      });

      return {
        success: true,
        bucket: process.env.R2_BUCKET,
        r2Key,
        publicUrl,
        fileSize,
        contentType,
        fileName: sanitizedFileName,
        productAnalysis,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", {
        step: 0,
        total: 5,
        message: "Upload and analysis failed",
      });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error",
      );

      logger.error("Failed to upload image to R2", { error, r2Key });
      throw error;
    }
  },
});
