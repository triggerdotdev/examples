# Voice agent demo

A voice chatbot built on a Trigger.dev
[chat agent](https://trigger.dev/docs/ai-chat/overview). You speak; it answers
out loud. The reply is synthesised in chunks as the model writes it, rather than
after the whole answer is ready.

```
mic ──► ElevenLabs Scribe ──► chat.agent ──► ElevenLabs Flash ──► speakers
        streaming STT         Claude Haiku    streaming TTS
```

## What you get

A voice assistant you hold a spoken conversation with in the browser:

- **Tap the mic once, then talk.** No button per turn — while it's listening,
  ElevenLabs' voice-activity detection decides when you've finished a sentence
  and sends it.
- **Replies are spoken as the model writes them.** Each sentence is sent for
  synthesis as soon as it's complete, so playback doesn't wait for the whole
  answer. (Replies here are short, so this is a modest head start, not a
  dramatic one.)
- **Interrupt** a reply you don't need with a button; the conversation keeps its
  place.
- **Multi-turn memory** within a sliding window, so follow-up questions make
  sense.
- **One config file** for the voice, the model, the personality, and the
  latency trade-offs.

It's a Trigger.dev chat agent plus two browser audio streams. The browser talks
straight to Trigger.dev — the only backend code is the agent and one small route
that speeds up the first reply.

---

## What you'll need

Accounts on three services:

| Service | What it does here | Sign up |
| --- | --- | --- |
| **Trigger.dev** | Runs the agent (the durable conversation loop) | [trigger.dev](https://trigger.dev) |
| **Anthropic** | The LLM (Claude Haiku) | [console.anthropic.com](https://console.anthropic.com) |
| **ElevenLabs** | Speech-to-text and text-to-speech | [elevenlabs.io](https://elevenlabs.io) |

Trigger.dev and Anthropic have free tiers that cover this. ElevenLabs' realtime
speech-to-text and some voices may need a paid plan — the free tier can't use
library voices through the API, so pick a voice from your own account.

Plus [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io/installation)
(`npm install -g pnpm`), and a Chromium browser (Chrome or Edge) for the mic.

---

## Setup

### 1. Install

```bash
git clone https://github.com/triggerdotdev/voice-agent-demo
cd voice-agent-demo
pnpm install
```

### 2. Create a Trigger.dev project

Sign in at [cloud.trigger.dev](https://cloud.trigger.dev), create a project,
and copy its **project ref** (looks like `proj_abc123`) from the project
settings. Open `trigger.config.ts` and paste it in, or set it via the
`TRIGGER_PROJECT_REF` environment variable in the next step.

### 3. Fill in your keys

Copy the example env file and fill in the four values:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
| --- | --- |
| `TRIGGER_SECRET_KEY` | Trigger.dev dashboard → your project → **API keys** → the `DEV` secret key |
| `TRIGGER_PROJECT_REF` | The `proj_...` ref from step 2 |
| `VOICE_ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → **API keys** |
| `ELEVENLABS_API_KEY` | [elevenlabs.io](https://elevenlabs.io) → profile → **API keys** (needs text-to-speech + speech-to-text permissions) |

> The Anthropic key is deliberately **not** named `ANTHROPIC_API_KEY` — that
> name is picked up by other tooling that can silently bill against it. This
> project reads its own prefixed name instead.

### 4. Run it

Two terminals, from the project root:

```bash
pnpm dev:trigger    # starts the agent — leave this running
```

The first time you run this it opens your browser to log in to Trigger.dev.

```bash
pnpm dev            # starts the web app at http://localhost:4000
```

Open **http://localhost:4000**, tap the mic, and start talking. ElevenLabs'
voice-activity detection decides when you've finished a thought, so just speak
naturally and pause.

---

## How it works

| File | Role |
| --- | --- |
| `trigger/chat.ts` | The agent — the turn loop, from turn 2 onwards |
| `lib/chat-handler.ts` | [Head Start](https://trigger.dev/docs/ai-chat/fast-starts): turn 1 runs in the web server while the agent boots in parallel, so the first reply isn't slow |
| `lib/voice-config.ts` | Every model id, voice id and tuning constant, in one place |
| `lib/model.ts` | Builds the Anthropic provider from a prefixed key (see below) |
| `app/actions.ts` | Mints the short-lived tokens the browser uses, so your API keys never reach the client |
| `app/lib/use-scribe.ts` | Microphone → text |
| `app/lib/use-eleven-tts.ts` | Reply text → audio, scheduled through Web Audio |
| `app/components/voice-chat.tsx` | Wires both audio streams to the agent |

Three things do most of the latency work: **Head Start** on the first turn,
**server-side VAD** deciding where your speech ends, and **streaming TTS** that
starts speaking before the whole reply is finished.

## Tuning

All in `lib/voice-config.ts`:

| Constant | Default | Effect |
| --- | --- | --- |
| `VAD_SILENCE_SECS` | `1` | Seconds of silence that end your turn. Lower feels snappier but cuts you off mid-thought; higher gives you room to pause |
| `HISTORY_TURNS` | `3` | Turns of conversation kept in context. Keeps latency flat; the cost is shorter memory |
| `MAX_REPLY_TOKENS` | `100` | Caps reply length so a turn can't run long |
| `TTS_VOICE_ID` | Roger | Any voice on your ElevenLabs account. Also settable via `NEXT_PUBLIC_TTS_VOICE_ID` |

Change the assistant's personality by editing `SYSTEM_PROMPT` in the same file.

## Deploying

```bash
pnpm deploy:trigger
```

Then set the same environment variables in the Trigger.dev dashboard (under your
project's **Production** environment) and point the web app at your production
`TRIGGER_SECRET_KEY`.

## Notes

- **Chromium only** — the microphone path needs Chrome or Edge.
- **Speaking waits its turn.** While the assistant is replying the mic is muted
  (so it doesn't transcribe its own voice); to cut a reply short, use the
  **Interrupt** button.
- **No persistence** — refreshing starts a new conversation.
- **The server actions have no authorization.** That's fine for a local
  example; add your own before deploying anywhere reachable.
