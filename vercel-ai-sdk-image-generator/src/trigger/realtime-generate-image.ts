import { openai } from "@ai-sdk/openai";
import { schemaTask } from "@trigger.dev/sdk/v3";
import { experimental_generateImage as generateImage } from "ai";
import { z } from "zod";

export const FalResult = z.object({
  images: z.tuple([z.object({ url: z.string() })]),
});

export const payloadSchema = z.object({
  prompt: z.string(),
  imageModel: z.string(),
});

export const realtimeImageGeneration = schemaTask({
  id: "realtime-image-generation",
  schema: payloadSchema,
  run: async (payload) => {
    const { image } = await generateImage({
      model: openai.image(payload.imageModel),
      prompt: payload.prompt,
      size: "1024x1024",
    });

    return {
      generatedImage: `data:image/jpeg;base64,${image.base64}`,
    };
  },
});
