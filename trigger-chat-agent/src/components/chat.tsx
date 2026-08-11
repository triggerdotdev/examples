"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Globe2,
  GraduationCap,
  Shuffle,
  Sparkles,
  Square,
} from "lucide-react";
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
const START_HERE = [
  "What is Trigger.dev, and how does it work?",
  "What's a task, and how do I run one?",
];
const GO_DEEPER = [
  "How is this app built?",
  "How do fan-out retries work?",
  "How do runs survive redeploys?",
  "How do queues control concurrency?",
  "How do waitpoints work?",
];
const MORE_TOPICS =
  "Suggest more Trigger.dev topics I could learn — mix beginner and advanced.";

const CHIP_KINDS: Record<
  string,
  { icon: typeof ArrowRight; className: string }
> = {
  deeper: {
    icon: ArrowRight,
    className:
      "border-apple-500/40 text-bright hover:bg-apple-500/10 [&_svg]:text-apple-500",
  },
  sideways: {
    icon: Shuffle,
    className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800",
  },
  practice: {
    icon: GraduationCap,
    className: "border-charcoal-700 text-bright hover:bg-charcoal-800",
  },
  topic: {
    icon: Sparkles,
    className: "border-charcoal-700 text-dimmed hover:bg-charcoal-800",
  },
};

type NextChip = { label: string; kind: string };
type MessagePartValue = UIMessage["parts"][number];
type MessagePartGroup =
  | { kind: "docs"; parts: MessagePartValue[] }
  | { kind: "part"; part: MessagePartValue };

function isDocsToolPart(part: MessagePartValue): boolean {
  if (
    part.type === "tool-renderVisualization" ||
    part.type === "tool-suggestNext"
  )
    return false;
  if (part.type === "dynamic-tool") {
    return (part as { toolName?: string }).toolName !== "suggestNext";
  }
  return part.type.startsWith("tool-");
}

/** Consecutive documentation lookups read as one connected provenance trail. */
function groupMessageParts(parts: MessagePartValue[]): MessagePartGroup[] {
  const groups: MessagePartGroup[] = [];
  for (const part of parts) {
    if (isDocsToolPart(part)) {
      const last = groups[groups.length - 1];
      if (last?.kind === "docs") last.parts.push(part);
      else groups.push({ kind: "docs", parts: [part] });
      continue;
    }

    // The AI SDK inserts structural parts between model steps. MessagePart
    // intentionally draws none of them; skipping them here also lets lookups
    // from successive steps stay on one connected spine.
    const visible =
      part.type === "text" ||
      part.type === "tool-renderVisualization" ||
      part.type === "tool-suggestNext" ||
      (part.type === "dynamic-tool" &&
        (part as { toolName?: string }).toolName === "suggestNext");
    if (visible) {
      groups.push({ kind: "part", part });
    }
  }
  return groups;
}

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
        (part.type === "dynamic-tool" &&
          (part as { toolName?: string }).toolName === "suggestNext");
      if (!isSuggest) continue;
      const input = (part as { input?: { chips?: NextChip[] } }).input;
      const chips = input?.chips?.filter((c) => c?.label) ?? [];
      if (chips.length) return chips;
    }
    return []; // reached the latest assistant turn; no chips (yet)
  }
  return [];
}

export function Chat() {
  const transport = useTriggerChatTransport<typeof triggerChatAgent>({
    task: "trigger-chat-agent",
    // Only needed when the agent runs somewhere other than cloud.trigger.dev
    // (e.g. self-hosted) — the server-side TRIGGER_API_URL isn't visible in the
    // browser, so the SSE endpoints get their base URL from this.
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  });

  const { messages, sendMessage, stop, status, error, regenerate, clearError } =
    useChat({ transport });
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
      lastRowRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
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

    const atBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
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
        <span className="font-mono text-2xs uppercase tracking-widest text-charcoal-500">
          interactive guide
        </span>
      </header>

      {/* The thread runs the full height and passes under the composer. Bottom
          padding clears the dock; the dock owns the fade and chips own blur. */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-44 pt-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700 sm:pt-8"
      >
        {/* Single child: what the ResizeObserver measures to follow the stream. */}
        <div className="space-y-8">
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center py-8 sm:py-12">
              <div className="w-full">
                <div className="mb-10 max-w-2xl sm:mb-12">
                  <div className="mb-3 font-mono text-xs uppercase tracking-wider text-apple-500">
                    Learn by asking
                  </div>
                  <h1 className="font-title text-[2.45rem] font-semibold leading-[1.08] tracking-tight text-bright [text-wrap:balance] sm:text-5xl">
                    See how Trigger.dev works, not just what it does.
                  </h1>
                  <p className="mt-5 max-w-[60ch] text-base leading-7 text-dimmed [text-wrap:pretty]">
                    Ask a question and get a visual lesson grounded in the live
                    docs, with diagrams, code, and quick checks for
                    understanding.
                  </p>
                </div>

                <ChipGroup
                  label="Start here"
                  items={START_HERE}
                  onPick={submit}
                  featured
                />
                <div className="mt-8">
                  <ChipGroup
                    label="Go deeper"
                    items={GO_DEEPER}
                    onPick={submit}
                  />
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
              <div
                key={message.id}
                ref={i === messages.length - 1 ? lastRowRef : undefined}
                className="scroll-mt-4"
              >
                <Message
                  message={message}
                  onPick={submit}
                  busy={busy}
                  reduce={!!reduce}
                />
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

      {/* Floats over the thread. A raised dark gradient separates the controls
          without blurring the whole footer; only chip surfaces blur. */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background from-50% via-background/90 via-80% to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 sm:px-6">
        {chips.length > 0 && !busy && (
          <div className="pointer-events-auto -mx-4 mb-3 overflow-hidden sm:-mx-6">
            {/* The rail reaches the column rules, so overflow hard-clips at the
                established borders. Left padding keeps its first chip aligned. */}
            <div className="flex gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] sm:pl-6 [&::-webkit-scrollbar]:hidden">
              {chips.map((chip, i) => {
                const kind = CHIP_KINDS[chip.kind] ?? CHIP_KINDS.topic;
                const Icon = kind.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => submit(chip.label)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border bg-charcoal-950/70 px-3 py-2 text-left text-xs font-medium leading-4 backdrop-blur-md transition-colors duration-150 ${kind.className}`}
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
            Answers are grounded in the live Trigger.dev docs — follow the links to check.
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
      <div className="mb-3 font-mono text-2xs uppercase tracking-widest text-charcoal-500">
        {label}
      </div>
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
          {message.parts.map((part, i) =>
            part.type === "text" ? <span key={i}>{part.text}</span> : null,
          )}
        </motion.div>
      </div>
    );
  }

  const groupedParts = groupMessageParts(message.parts);

  return (
    <div className="space-y-4 sm:space-y-5">
      {groupedParts.map((group, i) =>
        group.kind === "docs" ? (
          <DocsToolChain key={i} parts={group.parts} />
        ) : (
          <MessagePart
            key={i}
            part={group.part}
            onPick={onPick}
            busy={busy}
            reduce={reduce}
          />
        ),
      )}
    </div>
  );
}

function docsToolLabel(part: MessagePartValue): string {
  const toolName =
    part.type === "dynamic-tool"
      ? ((part as { toolName?: string }).toolName ?? "documentation")
      : part.type.replace(/^tool-/, "");
  const input = (part as { input?: Record<string, unknown> }).input;
  const query = typeof input?.query === "string" ? input.query : null;
  const library =
    typeof input?.libraryName === "string" ? input.libraryName : null;

  if (/resolve.*library|library.*resolve/i.test(toolName)) {
    return library
      ? `Find the ${library} documentation`
      : "Find the Trigger.dev documentation";
  }
  if (query) return query;
  return toolName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DocsToolChain({ parts }: { parts: MessagePartValue[] }) {
  const [expanded, setExpanded] = useState(false);
  const complete = parts.every(
    (part) => (part as { state?: string }).state === "output-available",
  );

  return (
    <div
      className="rounded-2xl border border-grid-dimmed bg-charcoal-950/60 px-4 py-3"
      aria-label="Documentation lookups"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="mb-1 flex min-h-10 w-full items-center gap-2 rounded-lg text-left"
      >
        <BookOpen className="size-3.5 text-apple-500" />
        <span className="font-mono text-2xs uppercase tracking-widest text-dimmed">
          Grounding in the docs
        </span>
        <span className="ml-auto font-mono text-2xs text-charcoal-500">
          {complete ? "Complete" : "Searching"}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-charcoal-500 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div className="relative space-y-3 before:absolute before:bottom-2 before:left-[0.4375rem] before:top-2 before:w-px before:bg-grid-bright">
        {parts.map((part, i) => {
          const done =
            (part as { state?: string }).state === "output-available";
          const label = docsToolLabel(part);
          return (
            <div key={i} className="relative flex min-w-0 items-start gap-3">
              <span className="relative z-10 mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-charcoal-950 text-dimmed">
                <Globe2 className="size-3.5" />
              </span>
              <span
                className={`min-w-0 flex-1 text-sm text-dimmed ${expanded ? "break-words leading-5" : "truncate"}`}
                title={label}
              >
                {label}
              </span>
              {done ? (
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-dimmed"
                  aria-label="Complete"
                />
              ) : (
                <span
                  className="relative mt-1 flex size-2 shrink-0"
                  aria-label="Searching"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-apple-500/60 motion-reduce:animate-none" />
                  <span className="relative size-2 rounded-full bg-apple-500" />
                </span>
              )}
            </div>
          );
        })}
      </div>
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
    const spec =
      part.state === "input-streaming" ? null : normalizeSpec(input?.spec);
    if (!spec) return <ToolStatus label="Drawing…" spinning />;
    if (output && output.ok === false)
      return <ToolStatus label="Refining…" spinning />;
    return <Visualization spec={spec} />;
  }

  // suggestNext chips render docked above the composer (they don't survive the
  // turn's finalization inline), so nothing is drawn here — and this guard keeps
  // the docs-tool fallthrough below from catching them.
  if (
    part.type === "tool-suggestNext" ||
    (part.type === "dynamic-tool" &&
      (part as { toolName?: string }).toolName === "suggestNext")
  ) {
    return null;
  }

  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const state = (part as { state?: string }).state;
    return (
      <ToolStatus
        label="Checking the Trigger.dev docs"
        spinning={state !== "output-available"}
        docs
      />
    );
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
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: easings.outExpo,
            }}
          />
          <span className="size-2 rounded-full bg-apple-500" />
        </span>
        Thinking…
      </div>
    </div>
  );
}

function ToolStatus({
  label,
  spinning,
  docs,
}: {
  label: string;
  spinning?: boolean;
  docs?: boolean;
}) {
  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-dimmed">
      <BookOpen
        className={`size-3 ${spinning ? "opacity-60" : ""} ${docs ? "" : "hidden"}`}
      />
      <span
        className={`size-1.5 rounded-full bg-apple-500 ${spinning ? "animate-pulse" : ""} ${docs ? "hidden" : ""}`}
      />
      {label}
    </div>
  );
}
