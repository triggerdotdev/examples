"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import { ArrowRight, ArrowUp, BookOpen, GraduationCap, Shuffle, Sparkles, Square } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { normalizeSpec } from "@/lib/catalog";
import { bubbleIn, easings } from "@/lib/motion";
import { AssistantText } from "@/components/streaming-text";
import { AgentWordmark } from "@/components/wordmark";
import { FocusGlow } from "@/components/composer-glow";
import { Visualization } from "@/components/visualization";
import type { triggerChatAgent } from "@/trigger/trigger-chat-agent";

// The empty-state seed. The altitude of the chip picked calibrates the session.
const START_HERE = ["What is Trigger.dev, and how does it work?", "What's a task, and how do I run one?"];
const GO_DEEPER = [
  "How does a fan-out with retries work?",
  "How does a run survive a redeploy?",
  "Queues vs concurrency — how do they interact?",
  "Waitpoints & human-in-the-loop",
];
const MORE_TOPICS = "Suggest more Trigger.dev topics I could learn — mix beginner and advanced.";

const CHIP_KINDS: Record<string, { icon: typeof ArrowRight; className: string }> = {
  deeper: { icon: ArrowRight, className: "border-apple-500/40 text-apple-500 hover:bg-apple-500/10" },
  sideways: { icon: Shuffle, className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800" },
  practice: { icon: GraduationCap, className: "border-charcoal-700 text-bright hover:bg-charcoal-800" },
  topic: { icon: Sparkles, className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800" },
};

export function Chat() {
  const transport = useTriggerChatTransport<typeof triggerChatAgent>({
    task: "trigger-chat-agent",
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });

  const { messages, sendMessage, stop, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const reduce = useReducedMotion();
  const busy = status === "submitted" || status === "streaming";

  // Land the newest turn at its TOP (tall answers start at the top, not pinned
  // to the bottom) — a genuine DOM effect, keyed on the message count.
  const lastRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    lastRowRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [messages.length]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between gap-2 py-4">
        <AgentWordmark className="text-lg" />
        <span className="font-mono text-2xs uppercase tracking-widest text-dimmed">learn trigger.dev</span>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-800 [mask-image:linear-gradient(to_bottom,transparent,#000_1.25rem,#000_calc(100%-1.25rem),transparent)]">
        {messages.length === 0 ? (
          <div className="mx-auto mt-16 max-w-lg space-y-6 text-center">
            <AgentWordmark className="text-[clamp(2rem,7vw,3rem)]" />
            <p className="text-sm text-dimmed">
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
        ) : (
          messages.map((message, i) => (
            <div key={message.id} ref={i === messages.length - 1 ? lastRowRef : undefined} className="scroll-mt-4">
              <Message message={message} onPick={submit} busy={busy} reduce={!!reduce} streamingNow={status === "streaming" && i === messages.length - 1} />
            </div>
          ))
        )}

        {status === "submitted" && <Thinking />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="py-4"
      >
        <div className="relative [&:focus-within]:[--lw3-glow-focus:1]">
          <FocusGlow radiusClassName="rounded-full" />
          <div className="relative z-10 flex items-center gap-2 rounded-full border border-charcoal-700 bg-charcoal-900 py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-charcoal-500">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how Trigger.dev works…"
              className="flex-1 border-0 bg-transparent px-0 py-2 text-sm text-foreground caret-apple-500 outline-none ring-0 placeholder:text-charcoal-500"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-charcoal-800 text-bright transition-colors hover:bg-charcoal-700"
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="group flex size-9 shrink-0 items-center justify-center rounded-full bg-apple-500 text-charcoal-900 shadow-[0_0_14px_rgba(64,204,127,0.45)] transition-colors duration-150 hover:bg-apple-400 disabled:bg-charcoal-800 disabled:text-charcoal-500 disabled:shadow-none"
                aria-label="Send"
              >
                <ArrowUp className="size-4 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2.5 text-center text-2xs text-charcoal-600">
          A Trigger.dev chat.agent. It can be wrong — check the linked docs.
        </p>
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
            className="rounded-full border border-charcoal-700 px-3 py-1.5 text-xs text-dimmed transition-colors hover:bg-charcoal-800 hover:text-bright"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({
  message,
  onPick,
  busy,
  reduce,
  streamingNow,
}: {
  message: UIMessage;
  onPick: (t: string) => void;
  busy: boolean;
  reduce: boolean;
  streamingNow: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <motion.div
          variants={bubbleIn}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="max-w-[80%] origin-bottom-right rounded-2xl rounded-br-sm bg-lavender-500 px-5 py-3 text-sm text-white"
        >
          {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => (
        <MessagePart key={i} part={part} onPick={onPick} busy={busy} reduce={reduce} streamingNow={streamingNow} />
      ))}
    </div>
  );
}

function MessagePart({
  part,
  onPick,
  busy,
  reduce,
  streamingNow,
}: {
  part: UIMessage["parts"][number];
  onPick: (t: string) => void;
  busy: boolean;
  reduce: boolean;
  streamingNow: boolean;
}) {
  if (part.type === "text") {
    const state = (part as { state?: "streaming" | "done" }).state;
    const streaming = state === "streaming" || (state === undefined && streamingNow);
    return (
      <div className="flex justify-start">
        <motion.div
          variants={bubbleIn}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="w-fit max-w-full origin-bottom-left rounded-2xl rounded-bl-sm border border-charcoal-700 bg-charcoal-850/75 px-5 py-3"
        >
          <AssistantText text={part.text} streaming={streaming} />
        </motion.div>
      </div>
    );
  }

  if (part.type === "tool-renderVisualization") {
    const input = part.input as { spec?: unknown } | undefined;
    const output = part.output as { ok?: boolean } | undefined;
    const spec = part.state === "input-streaming" ? null : normalizeSpec(input?.spec);
    if (!spec) return <ToolStatus label="Drawing…" spinning />;
    if (output && output.ok === false) return <ToolStatus label="Refining…" spinning />;
    return <Visualization spec={spec} />;
  }

  if (part.type === "tool-suggestNext") {
    const input = part.input as { chips?: { label: string; kind: string }[] } | undefined;
    const chips = input?.chips?.filter((c) => c?.label) ?? [];
    if (chips.length === 0) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-2">
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

  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const state = (part as { state?: string }).state;
    return <ToolStatus label="Checking the Trigger.dev docs" spinning={state !== "output-available"} docs />;
  }

  return null;
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 text-xs text-dimmed">
        <span className="relative flex size-2">
          <motion.span
            className="absolute inset-0 rounded-full bg-apple-500"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: easings.outExpo }}
          />
          <span className="size-2 rounded-full bg-apple-500" />
        </span>
        Thinking…
      </div>
    </div>
  );
}

function ToolStatus({ label, spinning, docs }: { label: string; spinning?: boolean; docs?: boolean }) {
  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-dimmed">
      <BookOpen className={`size-3 ${spinning ? "opacity-60" : ""} ${docs ? "" : "hidden"}`} />
      <span className={`size-1.5 rounded-full bg-apple-500 ${spinning ? "animate-pulse" : ""} ${docs ? "hidden" : ""}`} />
      {label}
    </div>
  );
}
