import { logger, schemaTask, task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import OpenAI from "openai";

type ApprovalToken = {
  memeVariant: 1 | 2 | 3;
};

// Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Main meme generator task with schema validation
export const generateMeme = schemaTask({
  id: "meme-generator",
  schema: z.object({
    prompt: z.string().min(1),
    userId: z.string().optional(),
  }),
  maxDuration: 600, // 10 minutes max duration
  run: async (payload, { ctx }) => {
    // Create a wait token for approval
    const token = await wait.createToken({
      timeout: "10m", // 10 minute timeout for approval
    });

    const imageResponse = await openai.images.generate({
      model: "dall-e-2",
      prompt: payload.prompt,
      size: "1024x1024",
      n: 2,
    });

    logger.log("Image generated", {
      url: imageResponse.data.map((image) => image.url),
    });

    // Send approval message to Slack with the generated images
    await sendSlackApprovalMessage({
      images: imageResponse.data.map((image) => image.url).filter((
        url,
      ): url is string => url !== undefined),
      tokenId: token.id,
      prompt: payload.prompt,
    });

    const result = await wait.forToken<ApprovalToken>(token.id);

    if (!result.ok) {
      throw new Error("Failed to get approval token");
    } else {
      console.log(
        "The meme that was chosen was variant",
        result.output.memeVariant,
      );
    }

    return {
      imageUrls: imageResponse.data.map((image) => image.url).filter(Boolean),
      selectedVariant: result.output.memeVariant,
      approved: true,
    };
  },
});

type SendApprovalMessageParams = {
  images: string[];
  userId?: string;
  tokenId: string;
  prompt: string;
};

export async function sendSlackApprovalMessage({
  images,
  userId = "unknown",
  tokenId,
  prompt,
}: SendApprovalMessageParams) {
  const webHookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webHookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set");
  }

  const message = {
    text: `Meme approval required`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎭 Meme Approval Required",
          emoji: true,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Requested by:* <@${userId}>`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Prompt:*\n${prompt}`,
        },
      },
      ...images.map((imageUrl, index) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Variant ${index + 1}*`,
        },
        accessory: {
          type: "image",
          image_url: imageUrl,
          alt_text: `Meme variant ${index + 1}`,
        },
      })),
      {
        type: "actions",
        elements: images.map((_, index) => ({
          type: "button",
          text: {
            type: "plain_text",
            text: `${index + 1}️⃣`,
            emoji: true,
          },
          style: "primary",
          value: JSON.stringify({
            tokenId,
            memeVariant: index + 1,
          }),
          action_id: `meme_approve_${index + 1}`,
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/${tokenId}?variant=${
            index + 1
          }`,
        })),
      },
    ],
  };

  try {
    const response = await fetch(webHookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Slack notification failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        sentPayload: message,
      });
      throw new Error(
        `Failed to send Slack notification: ${response.status} - ${errorText}`,
      );
    }

    logger.log("Slack notification sent successfully", {
      response: await response.text(),
    });
  } catch (error) {
    logger.error("Error sending Slack notification", {
      error,
      sentPayload: message,
    });
    throw error;
  }
}
