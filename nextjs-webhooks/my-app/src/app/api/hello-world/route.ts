// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { helloWorldTask } from "@/trigger/example";
import { tasks } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

//tasks.trigger also works with the edge runtime
//export const runtime = "edge";

export async function GET() {
  const handle = await tasks.trigger<typeof helloWorldTask>(
    "hello-world",
    "James",
  );

  return NextResponse.json(handle);
}
