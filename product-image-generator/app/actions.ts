"use server";

import { auth, tasks } from "@trigger.dev/sdk/v3";
import type { uploadImageToR2 } from "../src/trigger/image-upload";

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
