import { createAnthropic } from "@ai-sdk/anthropic";
import { CHAT_MODEL } from "./voice-config";

/**
 * Deliberately NOT the default `anthropic()` provider, because that reads
 * `ANTHROPIC_API_KEY` — the same variable Claude Code and other tooling honour,
 * where its presence silently redirects billing to the API key. Naming this
 * project's key separately keeps the two from ever being confused.
 *
 * Server-only. Don't import this from a client component.
 */
const workspaceId = process.env.VOICE_ANTHROPIC_WORKSPACE_ID;

const provider = createAnthropic({
  apiKey: process.env.VOICE_ANTHROPIC_API_KEY,
  // Identity-linked keys are rejected without this header ("anthropic-workspace-id
  // is required when authenticating with an identity-linked API key"). Ordinary
  // keys ignore it, so it's safe to send whenever it's configured.
  ...(workspaceId ? { headers: { "anthropic-workspace-id": workspaceId } } : {}),
});

/** The model both the agent and the head-start handler talk to. */
export const chatModel = provider(CHAT_MODEL);
