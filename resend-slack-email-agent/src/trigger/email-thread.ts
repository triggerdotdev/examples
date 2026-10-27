import { logger, runs, task, wait } from "@trigger.dev/sdk";
import { writeDraft } from "./draft";
import { bodyText, listThreadEmails, replyToEmail, type ThreadEmail } from "./resend";
import { allowedSender } from "./senders";
import { context, dmChannel, escapeMrkdwn, post, quote, quoteSections, section, update } from "./slack";

// What wakes a waiting thread run. The webhook tasks in inbound.ts complete the
// run's current wait token with one of these.
export type Signal =
  | { kind: "email" }
  | { kind: "feedback"; user: string; text: string }
  | { kind: "send"; user: string }
  | { kind: "discard"; user: string };

export const SEND_ACTION = "inbox_send";
export const DISCARD_ACTION = "inbox_discard";

// How long a quiet thread keeps its run. After this it ends; the next email in
// the thread starts a new run that carries on in the same Slack thread.
const IDLE_TIMEOUT = "30d";

export const emailTag = (threadId: string) => `email:${threadId}`;
export const slackTag = (ts: string) => `slack:${ts}`;

type Payload = { inboxId: string; threadId: string };
type Output = { slackTs: string; postedThrough: string };

// One run per email chain: it owns the chain's Slack thread (in the DM), posts each inbound
// email there, drafts a reply and waits. Waiting holds no machine or concurrency
// slot, so a chain can sit for weeks for free.
export const emailThread = task({
  id: "email-thread",
  run: async ({ inboxId, threadId }: Payload): Promise<Output> => {
    const channel = await dmChannel();
    const previous = await previousRun(threadId);
    let emails = await threadEmails(inboxId, threadId);

    // Emails up to this time are already in Slack.
    let postedThrough = previous?.postedThrough ?? "";
    let slackTs = previous?.slackTs;
    if (!slackTs) {
      const first = emails.find((e) => e.direction === "inbound");
      if (!first) return { slackTs: "", postedThrough };
      slackTs = await post(channel, `New email from ${first.from}: ${first.subject ?? "(no subject)"}`, emailBlocks(first, true));
      postedThrough = first.received_at;
    }

    let draft: string | undefined;
    let draftTs: string | undefined;
    const notes: string[] = [];
    let redraft = true;
    // The inbound email the last reply answered. Feedback on it is ignored, so
    // one email never gets two replies.
    let repliedTo: string | undefined;

    for (;;) {
      for (const e of emails) {
        if (e.direction !== "inbound" || e.received_at <= postedThrough) continue;
        await post(channel, `Reply from ${e.from}`, emailBlocks(e, false), slackTs);
        postedThrough = e.received_at;
      }

      const lastInbound = emails.findLast((e) => e.direction === "inbound");
      if (redraft && lastInbound) {
        draft = await writeDraft({ emails, notes, previousDraft: draft });
      }

      // Created before the draft is posted, so a click or an email that comes
      // in from here on finds it.
      const token = await wait.createToken({ timeout: IDLE_TIMEOUT, tags: [emailTag(threadId), slackTag(slackTs)] });

      if (redraft && draft) {
        draftTs = await post(channel, "Draft reply", draftBlocks(draft, token.id), slackTs);
        redraft = false;
      }

      // An email that arrived while this run was drafting found no token to
      // complete, so look for one now.
      const latest = await threadEmails(inboxId, threadId);
      if (latest.findLast((e) => e.direction === "inbound")?.id !== lastInbound?.id) {
        await wait.completeToken<Signal>(token, { kind: "email" });
      }

      const result = await wait.forToken<Signal>(token);
      if (!result.ok) {
        if (draft && draftTs) await update(channel, draftTs, "Draft expired", resolvedBlocks(draft, "_Expired: nobody sent it._"));
        return { slackTs, postedThrough };
      }

      const signal = result.output;
      logger.info("Signal", { kind: signal.kind });

      if (signal.kind === "send" && draft && draftTs && lastInbound) {
        // Keyed on the email being answered, so a retried attempt never sends twice.
        await replyToEmail(inboxId, threadId, lastInbound.id, draft, `reply-${lastInbound.id}`);
        await update(channel, draftTs, "Reply sent", resolvedBlocks(draft, ":white_check_mark: Sent"));
        repliedTo = lastInbound.id;
        draft = undefined;
        draftTs = undefined;
      } else if (signal.kind === "discard" && draft && draftTs) {
        await update(channel, draftTs, "Not sent", resolvedBlocks(draft, ":no_entry_sign: Not sent"));
        draft = undefined;
        draftTs = undefined;
      } else if (signal.kind === "feedback" && lastInbound?.id === repliedTo) {
        await post(channel, "Already replied", [context("Already replied to this email. I'll draft again when a new one comes in.")], slackTs);
      } else if (signal.kind === "feedback" || signal.kind === "email") {
        if (signal.kind === "feedback") notes.push(signal.text);
        // The old draft can't be sent any more: its token is used up.
        if (draft && draftTs) await update(channel, draftTs, "Old draft", resolvedBlocks(draft, "_Replaced by a newer draft below._"));
        redraft = true;
      }

      emails = await threadEmails(inboxId, threadId);
    }
  },
});

// The thread's emails, minus inbound ones from senders outside the allowlist:
// a disallowed sender who replies in an allowed thread is never shown, drafted
// for or answered. Outbound emails stay for context.
async function threadEmails(inboxId: string, threadId: string): Promise<ThreadEmail[]> {
  const emails = await listThreadEmails(inboxId, threadId);
  return emails.filter((e) => e.direction === "outbound" || allowedSender(e.from));
}

// When an earlier run of this chain timed out, the new one carries on in its
// Slack thread instead of starting another.
async function previousRun(threadId: string): Promise<Output | undefined> {
  for await (const r of runs.list({ tag: emailTag(threadId), taskIdentifier: "email-thread", status: ["COMPLETED"], limit: 1 })) {
    const output = (await runs.retrieve(r.id)).output as Output | undefined;
    if (output?.slackTs) return output;
  }
  return undefined;
}

function emailBlocks(email: ThreadEmail, first: boolean) {
  const heading = first
    ? `:email: *${escapeMrkdwn(email.subject ?? "(no subject)", 200)}*\nFrom ${escapeMrkdwn(email.from, 200)}`
    : `:email: Reply from ${escapeMrkdwn(email.from, 200)}`;
  return [section(heading), section(quote(bodyText(email)) || "_(empty)_")];
}

function draftBlocks(draft: string, tokenId: string) {
  return [
    ...quoteSections(":pencil: *Draft reply*", draft),
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", action_id: SEND_ACTION, value: tokenId, text: { type: "plain_text", text: "Send" } },
        { type: "button", action_id: DISCARD_ACTION, value: tokenId, text: { type: "plain_text", text: "Don't send" } },
      ],
    },
    context("Reply in this thread to tell me what to change."),
  ];
}

function resolvedBlocks(draft: string, status: string) {
  return [...quoteSections(":pencil: *Draft reply*", draft), context(status)];
}
