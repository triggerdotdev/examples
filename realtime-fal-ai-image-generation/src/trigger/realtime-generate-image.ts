import * as fal from "@fal-ai/serverless-client";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

export const FalResult = z.object({
  images: z.tuple([z.object({ url: z.string() })]),
});

export const payloadSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string(),
});

export const realtimeImageGeneration = schemaTask({
  id: "realtime-image-generation",
  schema: payloadSchema,
  run: async (payload) => {
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
      input: {
        image_url: payload.imageUrl,
        prompt: payload.prompt,
      },
      onQueueUpdate: (update) => {
        logger.info("Fal.ai processing update", { update });
      },
    });

    const $result = FalResult.parse(result);
    const [{ url: cartoonUrl }] = $result.images;

    return {
      imageUrl: cartoonUrl,
    };
  },
});
