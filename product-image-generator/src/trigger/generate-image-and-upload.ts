import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logger, metadata, task, wait } from "@trigger.dev/sdk";
import { Buffer } from "buffer";

import Replicate, { Prediction } from "replicate";
const replicate = new Replicate();

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const aiModel = "black-forest-labs/flux-dev";

const stylePrompts = {
  "isolated-table": `Professional product photography on clean white table with studio lighting, minimalist background, commercial style`,
  "lifestyle-scene": `Lifestyle product photography of a person of any gender or ethnicity in the sunshine holding the product in their hand with a big smile on their face - they should be pointing to the product. This should be a cool lifestyle shot`,
  "hero-shot": `Professional lifestyle shot of elegant hands holding and presenting the product, dramatic lighting, luxury commercial photography style, perfect for marketing materials, human interaction with product`,
  custom: "Professional product photography",
};

export type StylePrompt = keyof typeof stylePrompts;

type GeneratePayload = {
  promptStyle: StylePrompt;
  baseImageUrl: string;
  productAnalysis: {
    exact_product_name: string;
    model_number: string;
    material: string;
    colors: string[];
    shape: string;
    size_proportions: string;
    functional_elements: string[];
    surface_finish: string;
    text_branding: string;
    unique_features: string[];
    product_category: string;
  };
  customPrompt?: string; // User's custom prompt for "custom" style
  model?: "flux";
  size?: "1024x1792";
};

export const generateAndUploadImage = task({
  id: "generate-image-and-upload",
  maxDuration: 600, // 10 minutes max
  run: async (payload: GeneratePayload) => {
    const {
      promptStyle,
      baseImageUrl,
      productAnalysis,
      customPrompt,
      model = aiModel,
      size = "1024x1792",
    } = payload;

    // Set initial metadata with 4 steps (no analysis needed)
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 4,
      message: "Preparing image generation...",
    });

    logger.log("Starting image generation and upload", {
      promptStyle,
      baseImageUrl,
      productAnalysis,
      model,
    });

    try {
      // Step 2: Create structured prompt
      metadata.set("progress", {
        step: 2,
        total: 4,
        message: "Creating enhanced prompt...",
      });

      // Build detailed product description from analysis with fallbacks
      // const productDetails = [
      //   `Exact product: ${
      //     productAnalysis?.exact_product_name || "unknown product"
      //   }`,
      //   `Model number: ${productAnalysis?.model_number || "unknown model"}`,
      //   `Material: ${productAnalysis?.material || "unknown"}`,
      //   `Colors: ${productAnalysis?.colors?.join(", ") || "unknown"}`,
      //   `Shape: ${productAnalysis?.shape || "unknown"}`,
      //   `Proportions: ${productAnalysis?.size_proportions || "standard"}`,
      //   `Functional elements: ${
      //     productAnalysis?.functional_elements?.join(", ") || "standard"
      //   }`,
      //   `Surface finish: ${productAnalysis?.surface_finish || "standard"}`,
      //   `Text/branding: ${productAnalysis?.text_branding || "none"}`,
      //   `Unique features: ${
      //     productAnalysis?.unique_features?.join(", ") || "standard"
      //   }`,
      // ].join(". ");

      // Style-specific prompts
      const baseStylePrompt =
        customPrompt ||
        stylePrompts[promptStyle] ||
        stylePrompts["isolated-table"];

      // Combine everything into one unambiguous prompt
      const enhancedPrompt = `${baseStylePrompt}. MANDATORY PRODUCT PRESERVATION: You MUST recreate the EXACT product from the reference image. The product must be IDENTICAL to the reference image - same brand name, same exact model number, same exact colors and color combinations, same shape, same proportions, same text, same logos, same design elements, same materials, same finish. DO NOT change any colors, DO NOT substitute different models or color variants, DO NOT modify the product itself in any way. The product must be pixel-perfect identical. Only change the background, lighting, and camera angle. If you cannot preserve the exact product, do not generate the image.`;

      logger.log("Enhanced prompt created", {
        enhancedPrompt,
        promptStyle,
        customPrompt: customPrompt || "none provided",
        baseStylePrompt,
      });

      const token = await wait.createToken({
        timeout: "10m",
        tags: ["replicate"],
      });

      // Use Flux with structured prompt
      await replicate.predictions.create({
        model: "google/nano-banana",
        input: { prompt: enhancedPrompt, image_input: [baseImageUrl] },
        // pass the provided URL to Replicate's webhook, so they can "callback"
        webhook: token.url,
        webhook_events_filter: ["completed"],
      });

      const prediction = await wait.forToken<Prediction>(token);
      if (!prediction.ok) {
        throw new Error("Failed to create prediction");
      }

      logger.log("Prediction", prediction);

      const imageUrl = prediction.output.output;

      logger.log("Image generated successfully");

      // Step 4: Upload to storage
      metadata.set("progress", {
        step: 4,
        total: 4,
        message: "Uploading to storage...",
      });

      const image = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await image.arrayBuffer());

      const timestamp = Date.now();
      const filename = `generated-${timestamp}.png`.replace(
        /[^a-zA-Z0-9.-]/g,
        "_"
      );

      // Generate unique key for R2
      const r2Key = `uploaded-images/${timestamp}-${filename}`;

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
        fileSize: imageBuffer.byteLength,
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
        filename,
      };

      // Complete
      metadata.set("progress", {
        step: 4,
        total: 4,
        message: "Generation and upload completed!",
      });
      metadata.set("status", "completed");

      // Set final metadata with result - this is the best practice for Trigger.dev
      metadata.set("result", {
        success: true,
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
        imageSize: imageBuffer.length,
        contentType: "image/png",
        model,
        size,
        promptStyle,
        baseImageUrl,
      });

      return {
        success: true,
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
        imageSize: imageBuffer.length,
        contentType: "image/png",
        model,
        size,
        promptStyle,
        baseImageUrl,
      };
    } catch (error) {
      // Set error metadata
      metadata.set("status", "failed");
      metadata.set("progress", {
        step: 0,
        total: 4,
        message: "Generation and upload failed",
      });
      metadata.set(
        "error",
        error instanceof Error ? error.message : "Unknown error"
      );

      logger.error("Failed to generate and upload image", {
        error,
        promptStyle,
      });
      throw error;
    }
  },
});
