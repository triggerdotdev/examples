import { logger, task, wait } from "@trigger.dev/sdk";
import OpenAI from "openai";

// Define the ApprovalToken type
type ApprovalToken = {
  memeVariant: 1 | 2;
};

// Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Main meme generator task
export const generateMeme = task({
  id: "meme-generator",
  maxDuration: 600, // 10 minutes max duration
  run: async (payload: { prompt: string }) => {
    // Create a wait token for approval
    const token = await wait.createToken({
      timeout: "10m", // 10 minute timeout for approval
    });

    // Generate 2 meme variants in parallel using the subtask
    // You can only generate 1 image at a time using DALL-E 3, so we use batchTriggerAndWait to generate 2 memes in parallel
    const generatedMemes = await generateSingleMeme.batchTriggerAndWait([
      { payload: { prompt: payload.prompt } },
      { payload: { prompt: payload.prompt } },
    ]);

    // Get the first and second meme results
    const firstMeme = generatedMemes.runs.at(0);
    const secondMeme = generatedMemes.runs.at(1);

    // Check if both memes were generated successfully
    if (firstMeme?.ok !== true || secondMeme?.ok !== true) {
      throw new Error("Failed to generate memes");
    }

    // Get the generated image URLs
    const generatedImageUrl1 = firstMeme.output.imageUrl;
    const generatedImageUrl2 = secondMeme.output.imageUrl;

    // Send approval message to Slack with the generated images
    await sendSlackApprovalMessage({
      generatedImageUrl1,
      generatedImageUrl2,
      tokenId: token.id,
      prompt: payload.prompt,
    });

    // Wait for the approval token
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
      generatedImageUrl1,
      generatedImageUrl2,
      selectedVariant: result.output.memeVariant,
      approved: true,
    };
  },
});

// Subtask for generating a single meme image
export const generateSingleMeme = task({
  id: "generate-single-meme",
  run: async (payload: { prompt: string }) => {
    const generatedMeme = await openai.images.generate({
      model: "dall-e-3",
      prompt: payload.prompt,
      size: "1024x1024",
      n: 1,
    });

    if (generatedMeme.data.at(0)?.url === undefined) {
      throw new Error("Failed to generate meme");
    }

    return {
      imageUrl: generatedMeme.data[0].url as string,
    };
  },
});

type SendApprovalMessageParams = {
  generatedImageUrl1: string;
  generatedImageUrl2: string;
  tokenId: string;
  prompt: string;
};

// Send the approval message to Slack
export async function sendSlackApprovalMessage({
  generatedImageUrl1,
  generatedImageUrl2,
  tokenId,
  prompt,
}: SendApprovalMessageParams) {
  const webHookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webHookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set");
  }

  const message = {
    text: `Choose the funniest meme`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎭 Choose the funniest meme",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Prompt:*\n${prompt}`,
        },
      },
      // Divider before images
      {
        type: "divider",
      },
      // For each image, use a dedicated image block followed by a centered button
      ...[generatedImageUrl1, generatedImageUrl2].flatMap((imageUrl, index) => [
        // Large image block - takes full width
        {
          type: "image",
          title: {
            type: "plain_text",
            text: `Variant ${index + 1}`,
            emoji: true,
          },
          image_url: imageUrl,
          alt_text: `Meme variant ${index + 1}`,
          block_id: `image_${index + 1}`,
        },
        // Centered button for selection
        {
          type: "actions",
          block_id: `select_${index + 1}`,
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: `Select This Meme`,
                emoji: true,
              },
              style: "primary",
              value: JSON.stringify({
                tokenId,
                memeVariant: index + 1,
              }),
              action_id: `meme_approve_${index + 1}`,
              url:
                `${process.env.NEXT_PUBLIC_APP_URL}/endpoints/${tokenId}?variant=${
                  index + 1
                }`,
            },
          ],
        },
        // Add divider between variants
        ...(index < [generatedImageUrl1, generatedImageUrl2].length - 1
          ? [{
            type: "divider",
          }]
          : []),
      ]),
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
