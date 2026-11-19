// Small clients for Resend Inboxes, Recall.ai and a stand-in CRM.
import { chat } from "@trigger.dev/sdk/ai";


export const MEETING_SESSION = "live-meeting";

/**
 * A stand-in CRM with one account. Swap this for your real CRM's API (HubSpot, Attio, Salesforce…).
 */
const CRM = [
  {
    company: "Pied Piper",
    contact: "Erlich Bachman",
    plan: "Monthly",
    usage: "Usage has doubled this month compared with last month",
    openDeal: "Moving to an annual plan. In negotiation; discount not agreed yet",
    notes: "Growing fast. Very happy with the product, but Erlich always pushes hard on price",
  },
];

export async function lookupCrm(company: string) {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const account = CRM.find((a) => key(a.company) === key(company) || key(company).includes(key(a.company)));
  return account ? { found: true, ...account } : { found: false, company };
}

/**
 * The bot page's URL: it watches the meeting session read-only. `camera` is the agent's own tile
 * (it listens and speaks); `screen` is the lead brief it shares as a screenshare (silent).
 */
export async function botPageUrl(view: "camera" | "screen") {
  if (!process.env.BOT_PAGE_URL) throw new Error("Set BOT_PAGE_URL to the public URL of the web/ bot page");
  const page = new URL(process.env.BOT_PAGE_URL);
  page.searchParams.set("name", process.env.AGENT_NAME ?? "Scout");
  page.searchParams.set("token", await chat.createWatchToken(MEETING_SESSION, { tokenTTL: "6h" }));
  page.searchParams.set("api", process.env.TRIGGER_API_URL ?? "https://api.trigger.dev");
  page.searchParams.set("chat", MEETING_SESSION);
  page.searchParams.set("view", view);
  if (process.env.VERCEL_BYPASS_SECRET) {
    page.searchParams.set("x-vercel-protection-bypass", process.env.VERCEL_BYPASS_SECRET);
    page.searchParams.set("x-vercel-set-bypass-cookie", "true");
  }
  return page.toString();
}

export async function stopScreenshare(botId: string) {
  await recallApi(`/api/v1/bot/${botId}/output_media/`, {
    method: "DELETE",
    body: { screenshare: true },
  });
}

export async function inboxEmailBody(inboxId: string, threadId: string, emailId: string) {
  const res = await fetch(
    `https://api.resend.com/inboxes/${inboxId}/threads/${threadId}/emails/${emailId}`,
    { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } },
  );
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const email = (await res.json()) as { text: string | null; html: string | null };
  return (email.text ?? htmlToText(email.html ?? "")).slice(0, 6000);
}

async function resendApi<T>(path: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Save (or revise) a reply as a draft on the email's thread in the inbox. Never sends. */
export async function saveReplyDraft(input: {
  inboxId: string;
  threadId: string;
  emailId: string;
  to: string;
  subject: string;
  text: string;
  draftId?: string;
}) {
  if (input.draftId) {
    await resendApi(`/inboxes/${input.inboxId}/drafts/${input.draftId}`, "PATCH", {
      subject: input.subject,
      text: input.text,
    });
    return input.draftId;
  }
  const draft = await resendApi<{ id: string }>(`/inboxes/${input.inboxId}/drafts`, "POST", {
    thread_id: input.threadId,
    reply_to_email_id: input.emailId,
    to: [input.to],
    subject: input.subject,
    text: input.text,
  });
  return draft.id;
}

const RECALL_BASE =() => `https://${process.env.RECALL_REGION ?? "us-west-2"}.recall.ai`;

export async function recallApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${RECALL_BASE()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw new Error(`Recall ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
