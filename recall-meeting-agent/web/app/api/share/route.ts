export const runtime = "nodejs";

// Start the bot's screenshare (the lead brief / draft view of this same page).
// The bot page calls this the moment it starts speaking, so the screen lands with the voice.
export async function POST(req: Request) {
  const { botId, url } = (await req.json()) as { botId?: unknown; url?: unknown };
  if (typeof botId !== "string" || !/^[0-9a-f-]{36}$/i.test(botId) || typeof url !== "string") {
    return new Response("botId and url required", { status: 400 });
  }
  // Only ever share this app's own screen view.
  const target = new URL(url);
  if (target.origin !== new URL(req.url).origin || target.searchParams.get("view") !== "screen") {
    return new Response("url must be this app's screen view", { status: 400 });
  }
  // Behind Vercel Deployment Protection, Recall's screenshare browser has no session cookie, and the
  // bypass the camera page was opened with is gone from its URL by now (Vercel strips it after
  // setting the cookie). Add it back so the screenshare doesn't land on the Vercel login page.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.VERCEL_BYPASS_SECRET;
  if (bypass) {
    target.searchParams.set("x-vercel-protection-bypass", bypass);
    target.searchParams.set("x-vercel-set-bypass-cookie", "true");
  }

  const region = process.env.RECALL_REGION ?? "us-west-2";
  const res = await fetch(`https://${region}.recall.ai/api/v1/bot/${botId}/output_media/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ screenshare: { kind: "webpage", config: { url: target.toString() } } }),
  });
  if (!res.ok) return new Response(`Recall ${res.status}: ${await res.text()}`, { status: 502 });
  return Response.json({ sharing: true });
}
