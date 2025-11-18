import { tasks, runs } from "@trigger.dev/sdk/v3";
import { cloneRepo } from "@/trigger/clone-repo";
import { repoChatSession } from "@/trigger/repo-chat-session";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { githubUrl } = await request.json();

    // Validate inputs
    if (!githubUrl || typeof githubUrl !== "string") {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 }
      );
    }

    // Basic GitHub URL validation
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubUrlPattern.test(githubUrl)) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    }

    // Trigger the clone task
    const cloneHandle = await tasks.trigger<typeof cloneRepo>(
      "clone-repo",
      { githubUrl }
    );

    // Wait for clone to complete using pollForCompletion
    let cloneResult;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (attempts < maxAttempts) {
      const run = await runs.retrieve<typeof cloneRepo>(cloneHandle.id);

      if (run.status === "COMPLETED" && run.output) {
        cloneResult = { ok: true, output: run.output };
        break;
      } else if (run.status === "FAILED") {
        return NextResponse.json(
          { error: "Failed to clone repository" },
          { status: 500 }
        );
      }

      // Wait 1 second before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!cloneResult) {
      return NextResponse.json(
        { error: "Clone operation timed out" },
        { status: 500 }
      );
    }

    // Immediately trigger chat session with the cloned repo
    const chatHandle = await tasks.trigger<typeof repoChatSession>(
      "repo-chat-session",
      {
        tempDir: cloneResult.output.tempDir,
        sessionId: cloneResult.output.sessionId,
        repoName: cloneResult.output.repoName,
      }
    );

    // Get public access token from handle (auto-generated, expires in 15 min)
    const accessToken = chatHandle.publicAccessToken;

    // Return session details
    return NextResponse.json({
      sessionId: cloneResult.output.sessionId,
      chatRunId: chatHandle.id,
      accessToken,
      repoName: cloneResult.output.repoName,
      cloneRunId: cloneHandle.id, // Keep for backward compatibility
    });

  } catch (error: any) {
    console.error("Failed to trigger clone-repo task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start cloning" },
      { status: 500 }
    );
  }
}
