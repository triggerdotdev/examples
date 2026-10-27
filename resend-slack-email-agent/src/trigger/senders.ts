// Only emails from these domains reach Slack and get a draft. An inbox address
// is public, and every draft is a model call, so set ALLOWED_SENDER_DOMAINS
// (comma-separated) to ignore everyone else. Empty = draft for every sender.
export const ALLOWED_DOMAINS = (process.env.ALLOWED_SENDER_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export function allowedSender(from: string | undefined): boolean {
  if (ALLOWED_DOMAINS.length === 0) return true;
  const address = from?.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address?.trim().toLowerCase().split("@")[1];
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
