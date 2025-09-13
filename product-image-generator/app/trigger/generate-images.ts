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
  id: string;
  baseImageUrl: string;
  promptStyle: StylePrompt;
  customPrompt?: string;
};

export const generateImages = task({
  id: "generate-images",
  run: async (payload: { images: GeneratePayload[] }) => {
    // Step 1: Start the upload and analysis
    metadata.set("status", "starting");
    metadata.set("progress", {
      step: 1,
      total: 2,
      message: "Starting generation…",
    });

    await generateImage.batchTriggerAndWait(
      payload.images.map((p) => ({
        payload: p,
      }))
    );

    metadata.set("progress", {
      step: 2,
      total: 2,
      message: "Generation completed",
    });
    metadata.set("status", "completed");
  },
});

export const generateImage = task({
  id: "generate-image-and-upload",
  run: async (payload: GeneratePayload) => {
    const { promptStyle, baseImageUrl, customPrompt } = payload;

    // Set initial metadata with 4 steps (no analysis needed)
    metadata.root.set(payload.id, {
      status: "starting",
      progress: {
        step: 1,
        total: 4,
        message: "Preparing image generation...",
      },
    });

    logger.log("Starting image generation and upload", {
      promptStyle,
      baseImageUrl,
    });

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

    // Step 2: Generate image
    metadata.root.set(payload.id, {
      status: "generating",
      progress: {
        step: 2,
        total: 4,
        message: "Generating image...",
      },
    });

    const token = await wait.createToken({
      timeout: "10m",
      tags: ["replicate"],
    });

    // Generate image
    await replicate.predictions.create({
      model: "google/nano-banana",
      input: { prompt: enhancedPrompt, image_input: [baseImageUrl] },
      // pass the provided URL to Replicate's webhook, so they can "callback"
      webhook: token.url,
      webhook_events_filter: ["completed"],
    });

    // Wait for the result
    const prediction = await wait.forToken<Prediction>(token);
    if (!prediction.ok) {
      throw new Error("Failed to create prediction");
    }

    logger.log("Prediction", prediction);

    const imageUrl = prediction.output.output;

    logger.log("Image generated successfully");

    // Step 3: Upload to storage
    metadata.root.set(payload.id, {
      status: "uploading",
      progress: {
        step: 3,
        total: 4,
        message: "Uploading to storage...",
      },
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
    metadata.root.set(payload.id, {
      status: "completed",
      progress: {
        step: 4,
        total: 4,
        message: "Generation and upload completed!",
      },
      result: {
        success: true,
        publicUrl: uploadOutput.publicUrl,
        r2Key: uploadOutput.r2Key,
        imageSize: imageBuffer.length,
        contentType: "image/png",
        promptStyle,
        baseImageUrl,
      },
    });

    return {
      success: true,
      publicUrl: uploadOutput.publicUrl,
      r2Key: uploadOutput.r2Key,
      imageSize: imageBuffer.length,
      contentType: "image/png",
      promptStyle,
      baseImageUrl,
    };
  },
});
