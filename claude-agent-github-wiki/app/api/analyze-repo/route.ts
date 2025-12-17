import { tasks } from "@trigger.dev/sdk";
import type { analyzeRepo } from "@/trigger/analyze-repo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, question } = await request.json();

    // Validate inputs
    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 },
      );
    }

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    // Basic GitHub URL validation
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubUrlPattern.test(repoUrl)) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 },
      );
    }

    // Trigger the analyze task
    const handle = await tasks.trigger<typeof analyzeRepo>(
      "analyze-repo",
      { repoUrl, question },
    );

    // Get public access token from handle (auto-generated, expires in 15 min)
    const accessToken = handle.publicAccessToken;

    // Return run details
    return NextResponse.json({
      runId: handle.id,
      accessToken,
    });
  } catch (error: any) {
    console.error("Failed to trigger analyze-repo task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start analysis" },
      { status: 500 },
    );
  }
}
