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
      })),
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
  id: "generate-image",
  run: async ({
    id,
    promptStyle,
    baseImageUrl,
    customPrompt,
  }: GeneratePayload) => {
    const enhancedPrompt = prompt(promptStyle, customPrompt);

    logger.log("Starting image generation and upload", { enhancedPrompt });

    // Step 2: Generate image
    metadata.root.set(id, {
      status: "generating",
      message: "Generating image...",
    });

    const token = await wait.createToken({
      timeout: "10m",
      tags: ["replicate"],
    });

    // Generate image
    await replicate.predictions.create({
      model: "google/nano-banana",
      input: {
        prompt: enhancedPrompt,
        image_input: [baseImageUrl],
        aspect_ratio: "3:4",
      },
      // pass the provided URL to Replicate's webhook, so they can "callback"
      webhook: token.url,
      webhook_events_filter: ["completed"],
    });

    // Wait for the result
    const prediction = await wait.forToken<Prediction>(token);
    if (!prediction.ok) {
      throw new Error("Failed to create prediction");
    }

    const imageUrl = prediction.output.output;

    logger.log("Image generated successfully", { imageUrl });

    // Step 3: Upload to storage
    metadata.root.set(id, {
      status: "uploading",
      message: "Uploading to storage...",
    });

    const upload = await uploadImageToR2(imageUrl);

    // Complete
    metadata.root.set(id, {
      status: "completed",
      message: "Generation and upload completed!",
      result: upload,
    });

    return upload;
  },
});

const stylePrompts = {
  "isolated-table":
    `Professional lifestyle shot of elegant hands holding and presenting the product, dramatic lighting, luxury commercial photography style, perfect for marketing materials, human interaction with product`,
  "lifestyle-scene":
    `Lifestyle product photography of a person of any gender or ethnicity in the sunshine holding the product in their hand with a big smile on their face - they should be pointing to the product. This should be a cool lifestyle shot`,
  "hero-shot":
    `Create a shot of this product being used in a busy environment, with people interacting with it. The product should be the focal point of the image, and the people should be in the background.`,
  custom: "Professional product photography",
};

export type StylePrompt = keyof typeof stylePrompts;

// Generate enhanced prompt for image generation
function prompt(promptStyle: StylePrompt, customPrompt?: string) {
  // Style-specific prompts
  const baseStylePrompt = customPrompt || stylePrompts[promptStyle] ||
    stylePrompts["isolated-table"];

  // Combine everything into one unambiguous prompt
  const enhancedPrompt =
    `${baseStylePrompt}. MANDATORY PRODUCT PRESERVATION: You MUST recreate the EXACT product from the reference image. The product must be IDENTICAL to the reference image - same brand name, same exact model number, same exact colors and color combinations, same shape, same proportions, same text, same logos, same design elements, same materials, same finish. DO NOT change any colors, DO NOT substitute different models or color variants, DO NOT modify the product itself in any way. The product must be pixel-perfect identical. Only change the background, lighting, and camera angle. If you cannot preserve the exact product, do not generate the image.`;

  return enhancedPrompt;
}

async function uploadImageToR2(imageUrl: string, filename?: string) {
  const image = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await image.arrayBuffer());

  const timestamp = Date.now();
  const finalFilename = filename ||
    `generated-${timestamp}.png`.replace(/[^a-zA-Z0-9.-]/g, "_");

  // Generate unique key for R2
  const r2Key = `uploaded-images/${timestamp}-${finalFilename}`;

  const uploadParams = {
    Bucket: process.env.R2_BUCKET,
    Key: r2Key,
    Body: imageBuffer,
    ContentType: "image/png",
    // Add cache control for better performance
    CacheControl: "public, max-age=31536000", // 1 year
  };

  const result = await s3Client.send(new PutObjectCommand(uploadParams));
  logger.log(`Image uploaded successfully to R2`, { r2Key });

  // Construct the public URL using the R2_PUBLIC_URL env var
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

  return {
    publicUrl,
    r2Key,
    fileSize: imageBuffer.length,
    filename: finalFilename,
  };
}
