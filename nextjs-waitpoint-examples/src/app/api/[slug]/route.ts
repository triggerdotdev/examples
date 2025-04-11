import { wait } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = params;
    const body = await request.json();

    // Parse the payload from Slack
    const payload = JSON.parse(body.payload);
    const { tokenId } = JSON.parse(payload.actions[0].value);

    // Get the meme variant from the URL path (e.g., /meme-generator/1)
    const memeVariant = parseInt(slug.split("/").pop() || "1");

    // Complete the token with the selected meme variant
    await wait.completeToken(tokenId, {
      memeVariant,
    });

    // Return a success message to Slack
    return NextResponse.json({
      response_type: "ephemeral",
      text: `✅ Meme variant ${memeVariant} approved!`,
    });
  } catch (error) {
    console.error("Error handling Slack interaction:", error);
    return NextResponse.json(
      {
        response_type: "ephemeral",
        text: "❌ Failed to process approval. Please try again.",
      },
      { status: 500 },
    );
  }
}
