import { wait } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verify the request is from Slack
    if (body.type === "block_actions") {
      const { tokenId, memeVariant } = JSON.parse(body.actions[0].value);

      // Complete the token with the selected meme variant
      await wait.completeToken(tokenId, {
        memeVariant: parseInt(memeVariant),
      });

      // Return a success message to Slack
      return NextResponse.json({
        response_type: "ephemeral",
        text: `✅ Meme variant ${memeVariant} approved!`,
      });
    }

    return NextResponse.json({ ok: true });
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
