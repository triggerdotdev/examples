import type { helloWorldTask } from "@/trigger/example";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Parse the webhook payload
    const webhookData = await req.json();

    // Trigger the helloWorldTask with the webhook data as the payload
    const handle = await tasks.trigger<typeof helloWorldTask>(
      "hello-world",
      webhookData,
    );

    return NextResponse.json({ result: handle, ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "something went wrong", ok: false },
      { status: 500 },
    );
  }
}
