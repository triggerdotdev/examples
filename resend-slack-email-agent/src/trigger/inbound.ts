import { logger, runs, wait, webhook } from "@trigger.dev/sdk";
import type { SlackBlockActions, SlackMessageEvent } from "@trigger.dev/slack";
import { resendEvents, slackEvents } from "./endpoints";
import { DISCARD_ACTION, emailTag, emailThread, SEND_ACTION, slackTag, type Signal } from "./email-thread";
import { ephemeralReply, slackUser } from "./slack";

const ACTIVE = ["PENDING_VERSION", "DELAYED", "QUEUED", "DEQUEUED", "EXECUTING", "WAITING"] as const;

// Only emails from these domains reach Slack and get a draft. An inbox address
// is public, and every draft is a model call, so set ALLOWED_SENDER_DOMAINS
// (comma-separated) to ignore everyone else. Empty = draft for every sender.
const ALLOWED_DOMAINS = (process.env.ALLOWED_SENDER_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function allowedSender(from: string | undefined): boolean {
  if (ALLOWED_DOMAINS.length === 0) return true;
  const address = from?.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address?.trim().toLowerCase().split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

async function waitingToken(tag: string): Promise<string | undefined> {
  for await (const t of wait.listTokens({ status: "WAITING", tags: [tag] })) return t.id;
  return undefined;
}

// A new email in an inbox. If its chain already has a run waiting, wake it;
// if the run is busy, it checks for new email before it waits; otherwise start one.
export const resendEmailReceived = webhook({
  id: "resend-email-received",
  endpoint: resendEvents,
  filter: "event.type == 'inbox.email.received'",
  onEvent: async ({ event }) => {
    const { inbox_id: inboxId, thread_id: threadId, email_id: emailId, email } = event.data;
    if (email?.direction === "outbound") return;
    if (!allowedSender(email?.from)) {
      logger.info("Ignored email from a sender outside the allowed domains", { domains: ALLOWED_DOMAINS });
      return;
    }

    const token = await waitingToken(emailTag(threadId));
    if (token) {
      await wait.completeToken<Signal>(token, { kind: "email" });
      return;
    }

    for await (const _ of runs.list({ tag: emailTag(threadId), taskIdentifier: emailThread.id, status: [...ACTIVE], limit: 1 })) return;

    await emailThread.trigger(
      { inboxId, threadId },
      // Keyed on the email, so a redelivered webhook doesn't start a second run.
      { tags: [emailTag(threadId)], idempotencyKey: `email-${emailId}` }
    );
  },
});

// Slack: a reply in a chain's thread is feedback on the draft; a button click
// sends or drops it. Either way the chain's run is waiting on a token, and this
// completes it.
export const slackActivity = webhook({
  id: "slack-activity",
  endpoint: slackEvents,
  onEvent: async ({ event }) => {
    if (event.type === "block_actions") {
      await handleClick(event as SlackBlockActions);
      return;
    }

    const msg = (event as SlackMessageEvent).event;
    if (!msg || msg.type !== "message" || msg.subtype || msg.bot_id || !msg.user || !msg.thread_ts) return;
    // Only the one person's own messages in their DM with the bot.
    if (msg.channel_type !== "im" || msg.user !== slackUser()) return;
    const text = msg.text?.trim();
    if (!text) return;

    const token = await waitingToken(slackTag(msg.thread_ts));
    if (token) await wait.completeToken<Signal>(token, { kind: "feedback", user: msg.user, text });
  },
});

async function handleClick(click: SlackBlockActions) {
  const action = click.actions[0];
  const user = click.user?.id;
  if (!action?.value || !user) return;
  if (action.action_id !== SEND_ACTION && action.action_id !== DISCARD_ACTION) return;
  if (user !== slackUser()) return;

  // The button carries its draft's token. A used token means a newer draft
  // replaced this one, or someone already clicked.
  const token = await wait.retrieveToken(action.value);
  if (token.status !== "WAITING") {
    await ephemeralReply(click.response_url, "That draft is out of date. Use the latest one in the thread.");
    return;
  }

  await wait.completeToken<Signal>(action.value, { kind: action.action_id === SEND_ACTION ? "send" : "discard", user });
}
