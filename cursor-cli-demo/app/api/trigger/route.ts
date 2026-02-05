import { tasks } from "@trigger.dev/sdk";
import type { cursorAgentTask } from "@/trigger/cursor-agent";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = body as Record<string, unknown>;
  const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
  const model = typeof parsed.model === "string" ? parsed.model : undefined;

  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const handle = await tasks.trigger<typeof cursorAgentTask>("cursor-agent", { prompt, model });

  return Response.json({
    runId: handle.id,
    publicAccessToken: handle.publicAccessToken,
  });
}
