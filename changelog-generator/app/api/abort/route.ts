import { runs } from "@trigger.dev/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { runId } = await request.json();

    if (!runId || typeof runId !== "string") {
      return NextResponse.json(
        { error: "Run ID is required" },
        { status: 400 }
      );
    }

    await runs.cancel(runId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Failed to abort task:", error);
    const message = error instanceof Error ? error.message : "Failed to abort task";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
