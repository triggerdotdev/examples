// Resend Inboxes, through the Resend SDK: https://resend.com/docs/api-reference/inboxes
import { Resend } from "resend";

export type ResendWebhookEvent = {
  type: string;
  created_at: string;
  data: {
    inbox_id: string;
    thread_id: string;
    email_id: string;
    thread?: { id: string; subject: string | null };
    email?: { id: string; direction: "inbound" | "outbound"; from: string; subject: string | null };
  };
};

export type ThreadEmail = {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  received_at: string;
};

// Created on first use, so the task files load without RESEND_API_KEY set.
let client: Resend | undefined;
function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return (client ??= new Resend(key));
}

// Every message in the thread, oldest first, with bodies.
export async function listThreadEmails(inboxId: string, threadId: string): Promise<ThreadEmail[]> {
  const emails: ThreadEmail[] = [];
  let after: string | undefined;
  for (;;) {
    const { data, error } = await resend().inboxes.threads.emails.list({
      inboxId,
      threadId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error) throw new Error(`Resend list thread emails failed: ${error.message}`);
    emails.push(...data.data);
    if (!data.has_more || data.data.length === 0) return emails;
    after = data.data.at(-1)!.id;
  }
}

// Replies in the thread from the inbox address. The idempotency key stops a
// retried attempt from sending the same reply twice.
export async function replyToEmail(
  inboxId: string,
  threadId: string,
  emailId: string,
  text: string,
  idempotencyKey: string
): Promise<{ id: string }> {
  const { data, error } = await resend().inboxes.threads.emails.reply(
    { inboxId, threadId, emailId, text },
    { idempotencyKey }
  );
  if (error) throw new Error(`Resend reply failed: ${error.message}`);
  return data;
}

// The readable body of an email: its text part, or its HTML with the tags stripped.
export function bodyText(email: ThreadEmail): string {
  if (email.text?.trim()) return email.text.trim();
  return (email.html ?? "")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
