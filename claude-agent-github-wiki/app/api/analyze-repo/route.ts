import { tasks } from "@trigger.dev/sdk/v3";
import { cloneRepo } from "@/trigger/clone-repo";
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
    const handle = await tasks.trigger<typeof cloneRepo>(
      "clone-repo",
      { githubUrl }
    );

    // Return the run ID to track clone progress
    return NextResponse.json({
      cloneRunId: handle.id,
    });

  } catch (error: any) {
    console.error("Failed to trigger clone-repo task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start cloning" },
      { status: 500 }
    );
  }
}
