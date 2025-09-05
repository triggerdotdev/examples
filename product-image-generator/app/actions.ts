"use server";

import { auth, tasks } from "@trigger.dev/sdk/v3";
import type { uploadImageToR2 } from "../src/trigger/image-upload";
import type { batchGenerateAndUploadImages } from "../src/trigger/batch-generate-and-upload";
import type { generateAndUploadImage } from "../src/trigger/generate-and-upload-image";

export async function createPublicAccessToken(runId: string) {
  try {
    const publicAccessToken = await auth.createPublicToken({
      scopes: {
        read: {
          runs: [runId],
        },
      },
    });

    return {
      success: true as const,
      token: publicAccessToken,
    };
  } catch (error) {
    console.error("Error creating public access token:", error);
    return {
      success: false as const,
      error: "Failed to create access token",
    };
  }
}

export async function uploadImageToR2Action(formData: FormData) {
  try {
    const file = formData.get("image") as File;
    if (!file) {
      return {
        success: false as const,
        error: "No file provided",
      };
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    const handle = await tasks.trigger<typeof uploadImageToR2>(
      "upload-image-to-r2",
      {
        imageBuffer: base64,
        fileName: file.name,
        contentType: file.type,
      },
    );

    // Create a public access token for this specific run
    const tokenResult = await createPublicAccessToken(handle.id);

    if (!tokenResult.success) {
      return {
        success: false as const,
        error: tokenResult.error,
      };
    }

    return {
      success: true as const,
      runId: handle.id,
      accessToken: tokenResult.token,
    };
  } catch (error) {
    console.error("Error triggering image upload task:", error);
    return {
      success: false as const,
      error: "Failed to upload image",
    };
  }
}

export async function batchGenerateImagesAction(
  baseImageUrl: string,
  productDescription?: string,
) {
  try {
    const handle = await tasks.trigger<typeof batchGenerateAndUploadImages>(
      "batch-generate-and-upload-images",
      {
        baseImageUrl,
        productDescription,
      },
    );

    // Create a public access token for this specific run
    const tokenResult = await createPublicAccessToken(handle.id);

    if (!tokenResult.success) {
      return {
        success: false as const,
        error: tokenResult.error,
      };
    }

    return {
      success: true as const,
      runId: handle.id,
      accessToken: tokenResult.token,
    };
  } catch (error) {
    console.error("Failed to trigger batch generation:", error);
    return {
      success: false as const,
      error: "Failed to trigger batch generation",
    };
  }
}

export async function generateSingleImageAction(
  baseImageUrl: string,
  promptId: string,
  productDescription: string = "product",
) {
  try {
    // Define the prompts - emphasizing exact product replication
    const prompts = {
      "isolated-table":
        `Create a professional product photography shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Place this identical product isolated on a clean white table surface with studio lighting, minimalist background, commercial photography style, high resolution, sharp focus. The product must look exactly the same as in the reference image.`,
      "lifestyle-scene":
        `Create a lifestyle product photography shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Place this identical product in a modern home setting with natural lighting, styled environment, aspirational lifestyle, professional commercial photography. The product must look exactly the same as in the reference image, only the background and setting should change.`,
      "hero-shot":
        `Create a hero product shot showing the EXACT same product from the reference image, maintaining identical colors, textures, materials, and design details. Present this identical product with dramatic lighting, premium presentation, luxury commercial photography style, perfect for marketing materials, high-end aesthetic. The product must look exactly the same as in the reference image, only the lighting and presentation should be enhanced.`,
    };

    const prompt = prompts[promptId as keyof typeof prompts];
    if (!prompt) {
      return {
        success: false as const,
        error: "Invalid prompt ID",
      };
    }

    const handle = await tasks.trigger<typeof generateAndUploadImage>(
      "generate-and-upload-image",
      {
        prompt,
        baseImageUrl,
        model: "dall-e-3",
        size: "1024x1792", // Portrait format for better slot fitting
      },
    );

    // Create a public access token for this specific run
    const tokenResult = await createPublicAccessToken(handle.id);

    if (!tokenResult.success) {
      return {
        success: false as const,
        error: tokenResult.error,
      };
    }

    return {
      success: true as const,
      runId: handle.id,
      accessToken: tokenResult.token,
    };
  } catch (error) {
    console.error("Failed to trigger single image generation:", error);
    return {
      success: false as const,
      error: "Failed to trigger image generation",
    };
  }
}
