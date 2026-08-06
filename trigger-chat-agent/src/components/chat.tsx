"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import { ArrowRight, ArrowUp, BookOpen, GraduationCap, Loader2, Shuffle, Sparkles, Square, Zap } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { normalizeSpec } from "@/lib/catalog";
import { Visualization } from "@/components/visualization";
import type { triggerChatAgent } from "@/trigger/trigger-chat-agent";

// The empty-state seed. The altitude of the chip the learner picks is a
// zone-of-proximal-development signal the agent uses to calibrate the session.
const START_HERE = [
  "What is Trigger.dev, and how does it work?",
  "What's a task, and how do I run one?",
];
const GO_DEEPER = [
  "How does a fan-out with retries work?",
  "How does a run survive a redeploy?",
  "Queues vs concurrency — how do they interact?",
  "Waitpoints & human-in-the-loop",
];
const MORE_TOPICS = "Suggest more Trigger.dev topics I could learn — mix beginner and advanced.";

// Icon + accent per suggestNext chip kind.
const CHIP_KINDS: Record<string, { icon: typeof ArrowRight; className: string }> = {
  deeper: { icon: ArrowRight, className: "border-apple-500/40 text-apple-500 hover:bg-apple-500/10" },
  sideways: { icon: Shuffle, className: "border-border text-muted-foreground hover:bg-accent" },
  practice: { icon: GraduationCap, className: "border-border text-foreground hover:bg-accent" },
  topic: { icon: Sparkles, className: "border-border text-muted-foreground hover:bg-accent" },
};

export function Chat() {
  const transport = useTriggerChatTransport<typeof triggerChatAgent>({
    task: "trigger-chat-agent",
    // Only needed when the agent runs somewhere other than cloud.trigger.dev
    // (e.g. self-hosted) — the server-side TRIGGER_API_URL isn't visible in
    // the browser, so the SSE endpoints get their base URL from this.
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });

  const { messages, sendMessage, stop, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Zap className="size-4 fill-apple-500 text-apple-500" />
        <h1 className="font-title text-sm font-semibold">Trigger.dev chat agent</h1>
        <span className="ml-auto text-xs text-muted-foreground">Learn by doing, not walls of text</span>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary">
        {messages.length === 0 && (
          <div className="mx-auto mt-12 max-w-lg space-y-6">
            <p className="text-center text-sm text-muted-foreground">
              Learn how Trigger.dev works — it teaches you with interactive diagrams and lessons, grounded in the
              live docs. Pick a starting point:
            </p>
            <ChipGroup label="Start here" items={START_HERE} onPick={submit} />
            <ChipGroup label="Go deeper" items={GO_DEEPER} onPick={submit} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => submit(MORE_TOPICS)}
                className="inline-flex items-center gap-1.5 rounded-full border border-apple-500/40 px-3 py-1.5 text-xs font-medium text-apple-500 transition-colors hover:bg-apple-500/10"
              >
                <Sparkles className="size-3" /> Suggest more topics
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <Message key={message.id} message={message} onPick={submit} busy={busy} />
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t px-4 py-3"
      >
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask how Trigger.dev works…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-lg bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-secondary/80"
              aria-label="Stop"
            >
              <Square className="size-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-primary p-2 text-primary-foreground transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ChipGroup({ label, items, onPick }: { label: string; items: string[]; onPick: (t: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-center font-mono text-2xs uppercase tracking-widest text-dimmed/70">{label}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ message, onPick, busy }: { message: UIMessage; onPick: (t: string) => void; busy: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
          {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      {message.parts.map((part, i) => (
        <MessagePart key={i} part={part} onPick={onPick} busy={busy} />
      ))}
    </div>
  );
}

function MessagePart({ part, onPick, busy }: { part: UIMessage["parts"][number]; onPick: (t: string) => void; busy: boolean }) {
  if (part.type === "text") {
    return (
      <div className="prose-sm max-w-none leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  if (part.type === "tool-renderVisualization") {
    const input = part.input as { spec?: unknown } | undefined;
    const output = part.output as { ok?: boolean } | undefined;
    const spec = part.state === "input-streaming" ? null : normalizeSpec(input?.spec);

    // Wait for the full spec before rendering; if validation failed the
    // agent fixes the spec and calls the tool again.
    if (!spec) {
      return <ToolStatus label="Drawing…" spinning />;
    }
    if (output && output.ok === false) {
      return <ToolStatus label="Refining…" spinning />;
    }
    return <Visualization spec={spec} />;
  }

  // Next-step chips — the flywheel. The label is sent verbatim on click.
  if (part.type === "tool-suggestNext") {
    const input = part.input as { chips?: { label: string; kind: string }[] } | undefined;
    const chips = input?.chips?.filter((c) => c?.label) ?? [];
    if (chips.length === 0) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((chip, i) => {
          const kind = CHIP_KINDS[chip.kind] ?? CHIP_KINDS.topic;
          const Icon = kind.icon;
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => onPick(chip.label)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${kind.className}`}
            >
              <Icon className="size-3" /> {chip.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Docs MCP tool calls (dynamic names, e.g. resolve-library-id /
  // get-library-docs) — show a compact grounding indicator.
  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const state = (part as { state?: string }).state;
    return <ToolStatus label="Checking the Trigger.dev docs" spinning={state !== "output-available"} docs />;
  }

  return null;
}

function ToolStatus({ label, spinning, docs }: { label: string; spinning?: boolean; docs?: boolean }) {
  const Icon = docs ? BookOpen : Zap;
  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      {spinning ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}
      {label}
    </div>
  );
}
