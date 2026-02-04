import { tasks } from "@trigger.dev/sdk";
import type { cursorAgentTask } from "@/trigger/cursor-agent";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body.model === "string" ? body.model : undefined;

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const handle = await tasks.trigger<typeof cursorAgentTask>("cursor-agent", { prompt, model });

  return Response.json({
    runId: handle.id,
    publicAccessToken: handle.publicAccessToken,
  });
}
