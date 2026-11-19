import { gateway } from "@ai-sdk/gateway";
import { generateSpeech } from "ai";

export const runtime = "nodejs";

// Text to speech for the bot's voice (Gemini TTS through the AI Gateway).
// Only the bot page calls this. Keep the app behind auth (see the README) so nobody else spends your AI credits.
export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: unknown };
  if (typeof text !== "string" || !text.trim() || text.length > 1500) {
    return new Response("text required (max 1500 chars)", { status: 400 });
  }

  const { audio } = await generateSpeech({
    model: gateway.speech("google/gemini-3.8-flash-tts"),
    text,
    voice: "Puck",
    instructions:
      "A friendly, relaxed colleague leaning in during a meeting to give a quick heads-up. Natural pace, warm, not salesy.",
  });

  const bytes = audio.uint8Array;
  const type = audio.mediaType ?? "";
  // Gemini returns raw 16-bit PCM at 24 kHz; browsers need a container to play it.
  if (/pcm|l16/i.test(type)) {
    const rate = Number(type.match(/rate=(\d+)/)?.[1] ?? 24000);
    return new Response(wav(bytes, rate), { headers: { "content-type": "audio/wav" } });
  }
  return new Response(new Uint8Array(bytes), { headers: { "content-type": type || "audio/wav" } });
}

function wav(pcm: Uint8Array, sampleRate: number) {
  const header = new DataView(new ArrayBuffer(44));
  const write = (offset: number, s: string) => [...s].forEach((c, i) => header.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  header.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  write(36, "data");
  header.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header.buffer), 0);
  out.set(pcm, 44);
  return out;
}
