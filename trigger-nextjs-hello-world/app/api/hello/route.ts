import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { helloWorldTask } from "@/trigger/hello-world";

export async function POST() {
  try {
    const handle = await tasks.trigger<typeof helloWorldTask>("hello-world", {
      message: "Hello world",
    });

    return NextResponse.json({
      id: handle.id,
      publicAccessToken: handle.publicAccessToken,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to trigger task",
      },
      { status: 500 },
    );
  }
}
