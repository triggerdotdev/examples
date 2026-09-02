"use server";

// These server actions have no caller checks — fine for a local example.
// Add your own authorization before deploying anywhere reachable.

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { AGENT_ID } from "@/lib/voice-config";

// --- Trigger.dev session -----------------------------------------------

// Creates the session row and triggers the first run. Idempotent per chatId.
export const startChatSession = chat.createStartSessionAction(AGENT_ID);

// The transport calls this to refresh the browser's short-lived, session-scoped
// token. The environment's secret key never leaves the server.
export async function mintChatAccessToken(chatId: string) {
  return auth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  });
}

// --- ElevenLabs single-use tokens --------------------------------------

// Both voice sockets are opened by the browser, so they get 15-minute
// single-use tokens instead of the API key. ELEVENLABS_API_KEY stays here.
function elevenlabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  return new ElevenLabsClient({ apiKey });
}

/**
 * Next.js replaces server-action exceptions with a generic message in
 * production, which would hide exactly the detail you need here (missing key,
 * missing permission, quota). Log the real cause server-side and re-throw
 * something the UI can show without leaking the key itself.
 */
async function mintSingleUseToken(type: "realtime_scribe" | "tts_websocket") {
  try {
    const { token } = await elevenlabs().tokens.singleUse.create(type);
    return token;
  } catch (cause) {
    console.error(`[voice] failed to mint ${type} token`, cause);
    const detail = cause instanceof Error ? cause.message : String(cause);
    if (/missing the permission/i.test(detail)) {
      throw new Error(`ELEVENLABS_API_KEY lacks the permission needed for ${type}.`);
    }
    if (/ELEVENLABS_API_KEY is not set/.test(detail)) {
      throw new Error("ELEVENLABS_API_KEY is not set on the server.");
    }
    throw new Error(`Could not authorise ${type}.`);
  }
}

/** Token for the realtime speech-to-text socket (mic in). */
export async function mintScribeToken() {
  return mintSingleUseToken("realtime_scribe");
}

/** Token for the streaming text-to-speech socket (audio out). */
export async function mintTtsToken() {
  return mintSingleUseToken("tts_websocket");
}
