// Thin client for the Resend Inboxes API: https://resend.com/docs/api-reference/inboxes

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

async function resend<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Resend ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const threadPath = (inboxId: string, threadId: string) =>
  `/inboxes/${encodeURIComponent(inboxId)}/threads/${encodeURIComponent(threadId)}`;

// Every message in the thread, oldest first, with bodies.
export async function listThreadEmails(inboxId: string, threadId: string): Promise<ThreadEmail[]> {
  const emails: ThreadEmail[] = [];
  let after: string | undefined;
  for (;;) {
    const query = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
    const page = await resend<{ data: ThreadEmail[]; has_more: boolean }>(`${threadPath(inboxId, threadId)}/emails?${query}`);
    emails.push(...page.data);
    if (!page.has_more || page.data.length === 0) return emails;
    after = page.data.at(-1)!.id;
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
  return resend(`${threadPath(inboxId, threadId)}/emails/${encodeURIComponent(emailId)}/reply`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify({ text }),
  });
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
