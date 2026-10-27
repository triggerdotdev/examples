// Slack Web API calls the bot makes. Needs SLACK_BOT_TOKEN with chat:write and
// im:write. The bot only talks to one person, in its DM with them.

// The only Slack user the bot posts to and listens to.
export function slackUser(): string {
  const user = process.env.SLACK_USER_ID;
  if (!user) throw new Error("SLACK_USER_ID is not set");
  return user;
}

let dm: string | undefined;

// The bot's DM channel with that user (a D... id; chat.update needs it, not the user id).
export async function dmChannel(): Promise<string> {
  dm ??= (await slackApi("conversations.open", { users: slackUser() })).channel!.id;
  return dm;
}

async function slackApi(
  method: string,
  body: Record<string, unknown>
): Promise<{ ts?: string; channel?: { id: string } }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ unfurl_links: false, unfurl_media: false, ...body }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string; ts?: string; channel?: { id: string } };
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

// Posts a message, as a reply when threadTs is given. Returns the message ts.
export async function post(channel: string, text: string, blocks?: unknown[], threadTs?: string): Promise<string> {
  const { ts } = await slackApi("chat.postMessage", { channel, text, blocks, thread_ts: threadTs });
  return ts!;
}

export async function update(channel: string, ts: string, text: string, blocks?: unknown[]): Promise<void> {
  await slackApi("chat.update", { channel, ts, text, blocks: blocks ?? [] });
}

// Email text goes into Slack mrkdwn, so escape the three control characters
// (stops an email from @-mentioning people or faking links) and keep it under
// Slack's 3,000-character section limit.
export function escapeMrkdwn(text: string, max = 2800): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.length > max ? `${escaped.slice(0, max)}…` : escaped;
}

export const quote = (text: string) => `>${escapeMrkdwn(text).replace(/\n/g, "\n>")}`;

export const section = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
export const context = (text: string) => ({ type: "context", elements: [{ type: "mrkdwn", text }] });

// Answers a button click with a message only the clicker sees.
export async function ephemeralReply(responseUrl: string | undefined, text: string): Promise<void> {
  if (!responseUrl?.startsWith("https://hooks.slack.com/")) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", replace_original: false, text }),
  });
}
