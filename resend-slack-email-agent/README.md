# Resend email agent with Slack approval

An AI agent that drafts replies to the email in a [Resend Inboxes](https://resend.com/docs/api-reference/inboxes) inbox and sends nothing until you approve it in Slack.

Every email chain becomes its own thread in your DMs with the bot. The agent drafts a reply and posts it with **Send** and **Don't send** buttons. To change a draft, reply in the thread ("shorter", "say we're closed over Christmas") and it writes a new one. Later emails in the same chain land in the same Slack thread, with a new draft.

## How it works

Each email chain gets one long-running [Trigger.dev](https://trigger.dev) run that sleeps on a [wait token](https://trigger.dev/docs/wait-for-token) between events. The token is tagged with the email thread id and the Slack message timestamp, so a webhook from either side can find it and wake the run. A waiting run holds no machine and no concurrency slot, so a draft can wait days for your click.

- `src/trigger/endpoints.ts`: the two hosted webhook endpoints, one for Resend and one for Slack. Trigger.dev checks each request's signature before your code runs.
- `src/trigger/email-thread.ts`: one run per email chain. It posts the email to Slack, drafts a reply, creates a wait token and waits on it. A click sends or drops the draft, a thread reply redrafts it, and a new email posts and redrafts. After 30 quiet days the run ends; the next email starts a new run in the same Slack thread.
- `src/trigger/inbound.ts`: the webhook tasks. A new email wakes the chain's run, or starts one. Slack thread replies and button clicks complete the waiting token.
- `src/trigger/draft.ts`: the drafting prompt, using the [AI SDK](https://ai-sdk.dev) through the Vercel AI Gateway. Tune `SYSTEM_PROMPT` for your inbox.
- `src/trigger/resend.ts` and `src/trigger/slack.ts`: thin API clients.

What keeps it safe:

- **A person sends every reply.** The model has no tools, so a hostile email can only change the words of a draft you read first.
- **Email text is escaped** before it goes into Slack, so an email can't @-mention anyone or disguise a link.
- **Only you can act.** The Slack app is DM-only, and clicks or replies from anyone other than `SLACK_USER_ID` are ignored.
- **Senders can be filtered.** `ALLOWED_SENDER_DOMAINS` stops unknown senders before they reach Slack or cost a model call.
- **Sends are idempotent.** A retried attempt reuses the same Resend idempotency key, so nobody gets a reply twice.

Hosted webhooks are in public beta. The packages are pinned to the `4.8.0-webhooks` beta release.

## Setup

You need a [Trigger.dev](https://cloud.trigger.dev) project, a Resend inbox on a verified domain, a Slack workspace where you can create apps, and a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key.

1. Copy `.env.example` to `.env` and set `TRIGGER_PROJECT_REF`, `RESEND_API_KEY`, `SLACK_USER_ID`, `AI_GATEWAY_API_KEY` and `ALLOWED_SENDER_DOMAINS`.
2. Run `pnpm install` and `pnpm dev`. The `resend` and `slack` endpoints appear on your environment's **Webhooks** page with their URLs.
3. **Resend:** add a webhook pointing at the `resend` endpoint URL with the `inbox.email.received` event. Paste its signing secret into the `resend` endpoint in the Trigger.dev dashboard.
4. **Slack:** put the `slack` endpoint URL in both `request_url`s in `slack/manifest.yaml`, then create the app from it (**Create New App** > **From a manifest**). Paste the app's **Signing Secret** into the `slack` endpoint and click **Verify** in Slack's Event Subscriptions. Install the app and set `SLACK_BOT_TOKEN` (`xoxb-...`).
5. Restart `pnpm dev` and send an email to your inbox.

For production, run `pnpm run deploy`, set the same environment variables on the prod environment in the dashboard, and point Resend and Slack at the prod endpoint URLs.
