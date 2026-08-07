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
import { ErrorNotice } from "@/components/error-notice";
import { AgentWordmark } from "@/components/wordmark";
import { Visualization } from "@/components/visualization";
import type { triggerChatAgent } from "@/trigger/trigger-chat-agent";

// The empty-state seed. The altitude of the chip picked calibrates the session.
const START_HERE = ["What is Trigger.dev, and how does it work?", "What's a task, and how do I run one?"];
const GO_DEEPER = [
  "How is this app built?",
  "How do fan-out retries work?",
  "How do runs survive redeploys?",
  "How do queues control concurrency?",
  "How do waitpoints work?",
];
const MORE_TOPICS = "Suggest more Trigger.dev topics I could learn — mix beginner and advanced.";

const CHIP_KINDS: Record<string, { icon: typeof ArrowRight; className: string }> = {
  deeper: { icon: ArrowRight, className: "border-apple-500/40 text-bright hover:bg-apple-500/10 [&_svg]:text-apple-500" },
  sideways: { icon: Shuffle, className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800" },
  practice: { icon: GraduationCap, className: "border-charcoal-700 text-bright hover:bg-charcoal-800" },
  topic: { icon: Sparkles, className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800" },
};

type NextChip = { label: string; kind: string };

/**
 * The chips from the most recent assistant turn's `suggestNext` call. Read from
 * the message stream, but captured into sticky state (below) because the trailing
 * tool call is dropped when the turn finalizes — so we grab the chips while they
 * stream and keep them until the next user message.
 */
function latestSuggestNextChips(messages: UIMessage[]): NextChip[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    for (const part of m.parts) {
      const isSuggest =
        part.type === "tool-suggestNext" ||
        (part.type === "dynamic-tool" && (part as { toolName?: string }).toolName === "suggestNext");
      if (!isSuggest) continue;
      const input = (part as { input?: { chips?: NextChip[] } }).input;
      const chips = input?.chips?.filter((c) => c?.label) ?? [];
      if (chips.length) return chips;
    }
    return []; // reached the latest assistant turn; no chips (yet)
  }
  return [];
}

export function Chat({
  chatId,
  userId,
  initialMessages = [],
  initialSessions,
}: {
  chatId: string;
  userId: string;
  initialMessages?: UIMessage[];
  initialSessions?: Record<string, { publicAccessToken: string; lastEventId?: string }>;
}) {
  const transport = useTriggerChatTransport<typeof triggerChatAgent>({
    task: "trigger-chat-agent",
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
    // Owns the chat rows the agent writes in its lifecycle hooks.
    clientData: { userId },
    // Persisted token + SSE cursor, so a reload picks the stream back up
    // instead of replaying from the start.
    sessions: initialSessions,
  });

  const { messages, sendMessage, stop, status, error, regenerate, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  });
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<NextChip[]>([]);
  const reduce = useReducedMotion();
  const busy = status === "submitted" || status === "streaming";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastRowRef = useRef<HTMLDivElement>(null);
  // Whether the view should stick to the bottom as the answer grows. Armed on
  // send, dropped the moment the reader scrolls up to read something, re-armed
  // when they come back to the bottom.
  const followRef = useRef(true);

  // On send, bring the new turn into view.
  useEffect(() => {
    if (messages[messages.length - 1]?.role === "user") {
      followRef.current = true;
      lastRowRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Follow the answer as it streams. A ResizeObserver on the content is what
  // actually tracks growth — message count doesn't change while text streams
  // in, so a messages-keyed effect would never fire.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = scroller?.firstElementChild;
    if (!scroller || !content) return;

    const atBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    const onUserScroll = () => {
      followRef.current = atBottom();
    };
    scroller.addEventListener("wheel", onUserScroll, { passive: true });
    scroller.addEventListener("touchmove", onUserScroll, { passive: true });
    scroller.addEventListener("scroll", onUserScroll, { passive: true });

    const observer = new ResizeObserver(() => {
      if (followRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);

    return () => {
      scroller.removeEventListener("wheel", onUserScroll);
      scroller.removeEventListener("touchmove", onUserScroll);
      scroller.removeEventListener("scroll", onUserScroll);
      observer.disconnect();
    };
  }, []);

  // Capture the latest turn's next-step chips while they stream (they're dropped
  // when the turn finalizes). Only update on a non-empty set; cleared on send.
  useEffect(() => {
    const latest = latestSuggestNextChips(messages);
    if (latest.length) setChips(latest);
  }, [messages]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setChips([]);
    // Put the chat in the URL on the first message, via the History API rather
    // than the router: a Next navigation would remount this component and kill
    // the in-flight stream. The agent creates the row server-side with this id.
    if (messages.length === 0) {
      window.history.replaceState({}, "", `/chat/${chatId}`);
    }
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    // Side rules define the reading column, so content that scrolls past the
    // edge (the Next chips) reads as clipped by a boundary rather than cut off.
    // `relative` anchors the floating composer the thread scrolls beneath.
    <main className="relative mx-auto flex h-dvh w-full max-w-[52rem] flex-col border-x border-grid-dimmed px-4 sm:px-6">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-grid-dimmed">
        <AgentWordmark className="text-lg" />
        <span className="font-mono text-2xs uppercase tracking-widest text-charcoal-500">interactive guide</span>
      </header>

      {/* The thread runs the full height and passes under the composer: the
          bottom padding clears the dock, and the mask dissolves the last inch
          into the background so nothing hard-cuts behind the input. */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-44 pt-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700 [mask-image:linear-gradient(to_bottom,#000_calc(100%-7rem),transparent)] sm:pt-8"
      >
        {/* Single child: what the ResizeObserver measures to follow the stream. */}
        <div className="space-y-8">
        {messages.length === 0 ? (
          <div className="flex min-h-full items-center justify-center py-8 sm:py-12">
            <div className="w-full">
              <div className="mb-10 max-w-2xl sm:mb-12">
                <div className="mb-3 font-mono text-xs uppercase tracking-wider text-apple-500">Learn by asking</div>
                <h1 className="font-title text-[2.45rem] font-semibold leading-[1.08] tracking-tight text-bright [text-wrap:balance] sm:text-5xl">
                  See how Trigger.dev works, not just what it does.
                </h1>
                <p className="mt-5 max-w-[60ch] text-base leading-7 text-dimmed [text-wrap:pretty]">
                  Ask a question and get a visual lesson grounded in the live docs—with diagrams, code, and quick
                  checks for understanding.
                </p>
              </div>

              <ChipGroup label="Start here" items={START_HERE} onPick={submit} featured />
              <div className="mt-8">
                <ChipGroup label="Go deeper" items={GO_DEEPER} onPick={submit} />
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => submit(MORE_TOPICS)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-apple-500 transition-colors duration-150 hover:bg-apple-500/10"
                >
                  <Sparkles className="size-4" /> Suggest more topics
                </button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={message.id} ref={i === messages.length - 1 ? lastRowRef : undefined} className="scroll-mt-4">
              <Message message={message} onPick={submit} busy={busy} reduce={!!reduce} />
            </div>
          ))
        )}

        {status === "submitted" && <Thinking />}

        {error && (
          <ErrorNotice
            error={error}
            onRetry={() => {
              clearError();
              regenerate();
            }}
            onDismiss={clearError}
          />
        )}
        </div>
      </div>

      {/* Floats over the thread. Only the controls take pointer events, so the
          transparent gutter above them doesn't block scrolling. */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {chips.length > 0 && !busy && (
          <div className="pointer-events-auto mb-3 flex items-center gap-3">
            <span className="shrink-0 font-mono text-2xs uppercase tracking-widest text-charcoal-500">Next</span>
            {/* Fades the last chip out at the right edge, so the overflow reads
                as "more this way" instead of a hard crop. */}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((chip, i) => {
                const kind = CHIP_KINDS[chip.kind] ?? CHIP_KINDS.topic;
                const Icon = kind.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => submit(chip.label)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-left text-xs font-medium leading-4 transition-colors duration-150 ${kind.className}`}
                  >
                    <Icon className="size-3.5 shrink-0" /> {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form
          className="pointer-events-auto"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-charcoal-700 bg-charcoal-900 py-1.5 pl-4 pr-1.5 transition-[border-color,box-shadow] duration-200 focus-within:border-apple-400 focus-within:shadow-[0_0_0_3px_rgba(168,255,83,0.1)]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how Trigger.dev works…"
              aria-label="Message Trigger.dev guide"
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2.5 text-base text-foreground caret-apple-500 outline-none ring-0 placeholder:text-charcoal-500 focus-visible:outline-none"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-charcoal-800 text-bright transition-colors duration-150 hover:bg-charcoal-700"
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="group flex size-11 shrink-0 items-center justify-center rounded-xl bg-apple-500 text-charcoal-900 transition-colors duration-150 hover:bg-apple-400 disabled:bg-charcoal-800 disabled:text-charcoal-500"
                aria-label="Send"
              >
                <ArrowUp className="size-4 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-2xs leading-4 text-charcoal-500">
            A Trigger.dev chat.agent. It can be wrong — check the linked docs.
          </p>
        </form>
      </footer>
    </main>
  );
}

function ChipGroup({
  label,
  items,
  onPick,
  featured = false,
}: {
  label: string;
  items: string[];
  onPick: (t: string) => void;
  featured?: boolean;
}) {
  return (
    <section aria-label={label}>
      <div className="mb-3 font-mono text-2xs uppercase tracking-widest text-charcoal-500">{label}</div>
      <div
        className={
          featured
            ? "grid gap-2 sm:grid-cols-2"
            : "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0"
        }
      >
        {items.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className={`group flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-5 transition-colors duration-150 ${
              featured
                ? "border-charcoal-650 bg-charcoal-900 text-bright hover:border-apple-500/60 hover:bg-charcoal-850"
                : "w-56 shrink-0 border-grid-dimmed text-dimmed hover:border-charcoal-650 hover:bg-charcoal-900 hover:text-bright sm:w-auto sm:shrink"
            }`}
          >
            <span>{s}</span>
            <ArrowRight className="size-4 shrink-0 text-charcoal-500 transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:text-apple-500" />
          </button>
        ))}
      </div>
    </section>
  );
}

function Message({
  message,
  onPick,
  busy,
  reduce,
}: {
  message: UIMessage;
  onPick: (t: string) => void;
  busy: boolean;
  reduce: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <motion.div
          variants={bubbleIn}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="max-w-[85%] origin-bottom-right rounded-2xl rounded-br-sm bg-lavender-500 px-4 py-3 text-sm leading-6 text-charcoal-100 sm:max-w-[72%]"
        >
          {message.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {message.parts.map((part, i) => (
        <MessagePart key={i} part={part} onPick={onPick} busy={busy} reduce={reduce} />
      ))}
    </div>
  );
}

function MessagePart({
  part,
  onPick,
  busy,
  reduce,
}: {
  part: UIMessage["parts"][number];
  onPick: (t: string) => void;
  busy: boolean;
  reduce: boolean;
}) {
  if (part.type === "text") {
    return (
      <div className="flex justify-start">
        <motion.div
          variants={bubbleIn}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="w-fit max-w-full origin-bottom-left py-1"
        >
          <AssistantText text={part.text} />
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

  // suggestNext chips render docked above the composer (they don't survive the
  // turn's finalization inline), so nothing is drawn here — and this guard keeps
  // the docs-tool fallthrough below from catching them.
  if (part.type === "tool-suggestNext" || (part.type === "dynamic-tool" && (part as { toolName?: string }).toolName === "suggestNext")) {
    return null;
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
