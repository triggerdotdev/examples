import { runs } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { runId } = await request.json();

    // Validate input
    if (!runId || typeof runId !== "string") {
      return NextResponse.json(
        { error: "Run ID is required" },
        { status: 400 }
      );
    }

    // Cancel the running task
    // This will trigger the AbortController in the task, which propagates to the Claude agent
    await runs.cancel(runId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to abort task:", error);
    return NextResponse.json(
      { error: error.message || "Failed to abort task" },
      { status: 500 }
    );
  }
}
