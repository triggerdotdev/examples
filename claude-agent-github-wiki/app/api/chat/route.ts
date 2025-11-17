import { tasks, runs } from "@trigger.dev/sdk/v3";
import { chatWithRepo } from "@/trigger/chat-with-repo";
import { cloneRepo } from "@/trigger/clone-repo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { cloneRunId, query } = await request.json();

    // Validate inputs
    if (!cloneRunId || typeof cloneRunId !== "string") {
      return NextResponse.json(
        { error: "Clone run ID is required" },
        { status: 400 }
      );
    }

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Fetch the clone task result to get tempDir
    const cloneRun = await runs.retrieve<typeof cloneRepo>(cloneRunId);

    if (!cloneRun.output) {
      return NextResponse.json(
        { error: "Clone task has not completed yet or failed" },
        { status: 400 }
      );
    }

    const { tempDir, repoName } = cloneRun.output;

    // Trigger the chat task
    const handle = await tasks.trigger<typeof chatWithRepo>(
      "chat-with-repo",
      { tempDir, query, repoName }
    );

    // Generate public access token for stream
    const publicAccessToken = await handle.publicAccessToken();

    // Return the chat run ID and access token
    return NextResponse.json({
      chatRunId: handle.id,
      accessToken: publicAccessToken,
      repoName,
    });

  } catch (error: any) {
    console.error("Failed to trigger chat task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start chat" },
      { status: 500 }
    );
  }
}
