"use server";

import { auth, tasks } from "@trigger.dev/sdk";
import type { generateAndUploadImage } from "../src/trigger/generate-and-upload-image";
import type { uploadImageToR2 } from "../src/trigger/image-upload";
import type { ProductAnalysis } from "./types/trigger";

export async function triggerUploadTask(payload: {
  imageBuffer: string;
  fileName: string;
  contentType: string;
}) {
  try {
    const handle = await tasks.trigger<typeof uploadImageToR2>(
      "upload-image-to-r2",
      payload,
    );

    // Create a public access token for this specific run
    const publicAccessToken = await auth.createPublicToken({
      scopes: {
        read: {
          runs: [handle.id],
        },
      },
    });

    return {
      success: true as const,
      runId: handle.id,
      publicAccessToken,
    };
  } catch (error) {
    console.error("Error triggering upload task:", error);
    return { success: false as const, error: "Failed to trigger upload task" };
  }
}

export async function triggerGenerationTask(payload: {
  promptStyle: string;
  baseImageUrl: string;
  productAnalysis: ProductAnalysis;
  customPrompt?: string;
  model?: "flux";
  size?: "1024x1792";
}) {
  try {
    const handle = await tasks.trigger<typeof generateAndUploadImage>(
      "generate-and-upload-image",
      payload,
    );

    // Create a public access token for this specific run
    const publicAccessToken = await auth.createPublicToken({
      scopes: {
        read: {
          runs: [handle.id],
        },
      },
    });

    return {
      success: true as const,
      runId: handle.id,
      publicAccessToken,
    };
  } catch (error) {
    console.error("Error triggering generation task:", error);
    return {
      success: false as const,
      error: "Failed to trigger generation task",
    };
  }
}
