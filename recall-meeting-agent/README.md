# Recall.ai meeting agent with Trigger.dev

An AI teammate that sits quietly in your video call and only speaks when something important happens.

When a new email lands in your team inbox mid-call, the agent looks the sender up in your CRM, waits for a pause in the conversation, gives the room a short spoken heads-up, and shares the email and the customer's CRM record on screen. Ask it to "draft a reply saying..." and it writes the reply, saves it as a draft in your inbox and puts it on screen. It never sends anything.

- **[Trigger.dev](https://trigger.dev)** runs the agent. A `chat.agent` session stays open for the whole meeting and wakes up on webhook events, so it costs nothing while it waits.
- **[Trigger.dev webhooks](https://trigger.dev/docs/webhooks/overview)** receive and verify events from Resend (new emails) and Recall.ai (the live transcript) and route them into that session.
- **[Recall.ai](https://www.recall.ai)** puts a bot in the meeting. Its camera is a web page you host (`web/`), which listens to the room, speaks and screenshares.
- **[Resend Inboxes](https://resend.com/docs/dashboard/inboxes/introduction)** is the team inbox the agent watches and saves drafts to.
- **[AI SDK](https://ai-sdk.dev)** with the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) for the model (Claude) and the voice (Gemini text to speech).

## How it works

1. You run the `join-meeting` task with a meeting link. It creates a Recall bot whose camera is the bot page, with a real-time endpoint that posts each finished sentence of the transcript to the `recall` webhook endpoint.
2. Every transcript sentence and every new inbox email is routed to one `chat.agent` session (`live-meeting`) as an action. Most actions just update the agent's notes. A new email starts a turn, and so does someone talking to the agent by name ("Hey Scout, …").
3. For an email, the agent calls `lookup_crm` with the sender's company, then `present_lead`, which puts the email and the CRM record on screen exactly as they are (nothing on screen is written by the model). Its final message is the only thing that gets spoken.
4. The bot page watches the session's output stream. When an answer arrives it generates the voice straight away, waits until nobody has spoken for 1.2 seconds, then speaks and starts the screenshare at the same moment.

## Project layout

```
src/trigger/
  endpoints.ts      Resend and Recall.ai webhook endpoints
  agent.ts          the meeting agent (chat.agent, routing, tools, prompt)
  join-meeting.ts   task that sends the bot into a meeting
  send-test-email.ts  task that emails your inbox as a customer, for trying it out
  services.ts       Resend and Recall.ai helpers, and a stand-in CRM
web/                the bot page (Next.js): camera tile, screenshare view, voice and share routes
```

## Setup

You need a Trigger.dev account, a Recall.ai account, a Resend account with an inbox, and a Vercel AI Gateway key.

### 1. Install

```bash
pnpm install
cp .env.example .env
```

Set `project` in `trigger.config.ts` to your project ref, from your Trigger.dev project settings.

### 2. Deploy the bot page

The Recall bot loads the page in `web/` from the internet, so it has to be publicly reachable.

```bash
cd web
pnpm install
cp .env.example .env.local
```

Deploy it to any host that runs Next.js and set the variables from `web/.env.example` there. On Vercel:

```bash
vercel deploy --prod
```

The page's API routes spend your AI Gateway and Recall credits, so don't leave it open. On Vercel, turn on Deployment Protection for all deployments, then create a **Protection Bypass for Automation** secret and put it in `VERCEL_BYPASS_SECRET`. The `join-meeting` task adds it to the URL it gives Recall, so only the bot gets in.

Put the page's URL in `BOT_PAGE_URL` in the root `.env`.

To check the layout without a meeting, open `/?demo` (camera tile), `/?demo&view=screen` (email and CRM record) or `/?demo=draft&view=screen` (reply draft).

### 3. Run the tasks

From the project root (step 2 left you in `web/`):

```bash
cd ..
pnpm dev
```

This registers two webhook endpoints, `inbox` and `recall`, in your dev environment. Find their URLs on the **Webhooks** page in the dashboard.

### 4. Connect Resend

1. In Resend, create an inbox if you don't have one.
2. Add a webhook pointing at the `inbox` endpoint URL, subscribed to `inbox.email.received`.
3. Copy the webhook's signing secret (`whsec_...`) and store it on the endpoint:

```bash
npx trigger.dev@latest webhooks set-secret inbox --env dev
```

### 5. Connect Recall.ai

1. On the Recall dashboard's API keys page, create a **workspace secret** (`whsec_...`). Recall only signs webhooks once it exists.
2. Store it on the `recall` endpoint:

```bash
npx trigger.dev@latest webhooks set-secret recall --env dev
```

You don't add the URL in Recall's dashboard. The `join-meeting` task sets it on each bot as a real-time endpoint.

### 6. Try it

1. Start a Google Meet, Zoom or Teams call.
2. Trigger `join-meeting` from the dashboard's **Test** page:

```json
{ "meetingUrl": "https://meet.google.com/abc-defg-hij" }
```

3. Admit the bot, then trigger `send-test-email` so an email from the customer in the stand-in CRM lands a minute later:

```json
{ "to": "sales@yourdomain.com", "from": "Erlich Bachman <erlich@yourdomain.com>", "delaySeconds": 60 }
```

   `to` is your Resend inbox address. `from` can be any address on a domain you've verified in Resend.
4. Keep talking. When the email arrives, the agent waits for a pause, gives a heads-up and shares the email next to the customer's CRM record.
5. Talk to it by name: "Hey Scout, draft a reply saying we can do 10% off." The draft shows on screen and is saved in your inbox. It never sends.

## Use your own CRM

`lookupCrm` in `src/trigger/services.ts` reads from a hard-coded list with one account. Replace it with a call to your CRM's API (HubSpot, Attio, Salesforce…) and return the fields you want on screen.

## Deploy

```bash
pnpm deploy
```

Set the variables from `.env.example` on your production environment, then connect Resend and Recall.ai again with the production endpoint URLs and `--env prod`.

## Environment variables

| Variable | Where | What it's for |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | tasks, web | Model calls and text to speech |
| `RESEND_API_KEY` | tasks | Reading inbox emails, saving drafts |
| `RECALL_API_KEY` | tasks, web | Creating the bot, screenshare |
| `RECALL_REGION` | tasks, web | Your Recall workspace region |
| `BOT_PAGE_URL` | tasks | Public URL of the deployed bot page |
| `VERCEL_BYPASS_SECRET` | tasks, web | Optional: lets the bot and its screenshare past Vercel Deployment Protection |
| `AGENT_NAME` | tasks | Optional: the agent's name and wake word (default Scout) |
| `COMPANY_NAME` | tasks | Optional: the company the agent works for (default Acme) |

## License

Apache 2.0
