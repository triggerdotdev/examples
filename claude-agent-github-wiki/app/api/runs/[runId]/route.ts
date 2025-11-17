import { runs } from "@trigger.dev/sdk/v3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json(
        { error: "Run ID is required" },
        { status: 400 }
      );
    }

    // Fetch the run status and output
    const run = await runs.retrieve(runId);

    return NextResponse.json({
      status: run.status,
      output: run.output,
      error: run.error,
    });

  } catch (error: any) {
    console.error("Failed to fetch run status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch run status" },
      { status: 500 }
    );
  }
}
