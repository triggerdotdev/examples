import { tasks } from "@trigger.dev/sdk";
import type { generateChangelog } from "@/trigger/generate-changelog";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, startDate, endDate } = await request.json();

    // Validate inputs
    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start and end dates are required" },
        { status: 400 }
      );
    }

    // Basic GitHub URL validation
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubUrlPattern.test(repoUrl)) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format" },
        { status: 400 }
      );
    }

    // Trigger the changelog task
    const handle = await tasks.trigger<typeof generateChangelog>(
      "generate-changelog",
      { repoUrl, startDate, endDate }
    );

    return NextResponse.json({
      runId: handle.id,
      accessToken: handle.publicAccessToken,
    });
  } catch (error: unknown) {
    console.error("Failed to trigger generate-changelog task:", error);
    const message = error instanceof Error ? error.message : "Failed to start changelog generation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
