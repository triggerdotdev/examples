import { webhooks } from "@trigger.dev/sdk";
import { webhookSource, type SlackBlockActions, type SlackMessageEvent } from "@trigger.dev/slack";
import type { ResendWebhookEvent } from "./resend";

// Hosted endpoints. Their URLs and signing secrets are on the environment's
// Webhooks page in the dashboard.

// Resend Inboxes events (inbox.email.received). Paste the Resend webhook's
// signing secret as this endpoint's secret.
export const resendEvents = webhooks.endpoint.define({ id: "resend", source: webhooks.resend<ResendWebhookEvent>() });

// Slack thread replies and button clicks. Paste the Slack app's Signing Secret
// as this endpoint's secret.
export const slackEvents = webhooks.endpoint.define({
  id: "slack",
  source: webhookSource<SlackMessageEvent | SlackBlockActions>(),
});
