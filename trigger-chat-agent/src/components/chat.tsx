"use client";

import { Chat as AIChat, useChat } from "@ai-sdk/react";
import {
  TriggerChatTransport,
  type ChatSessionPersistedState,
} from "@trigger.dev/sdk/chat";
import type { UIMessage } from "ai";
import {
  AlertTriangle,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { normalizeSpec } from "@/lib/catalog";
import { saveMessages, saveSession, setTitle } from "@/lib/chat-store";
import { bubbleIn, easings } from "@/lib/motion";
import { AssistantText } from "@/components/streaming-text";
import { ErrorNotice } from "@/components/error-notice";
import { QuizGateContext } from "@/components/quiz-gate";
import { TriggerLogo } from "@/components/trigger-logo";
import { AgentWordmark } from "@/components/wordmark";
import { Visualization } from "@/components/visualization";
import { ThinkingOrb } from "@/components/thinking-orb";

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
  | { kind: "part"; part: MessagePartValue; partIndex: number };

// Message parts are a discriminated union on `type`. These helpers narrow to
// the fields we read without structural `as` casts: tool and dynamic-tool parts
// carry `state`/`input`/`output`, and dynamic-tool parts a `toolName`.
const TERMINAL_TOOL_STATES = new Set(["output-available", "output-error"]);

function partState(part: MessagePartValue): string | undefined {
  return "state" in part && typeof part.state === "string" ? part.state : undefined;
}
function isSettled(part: MessagePartValue): boolean {
  const state = partState(part);
  return state !== undefined && TERMINAL_TOOL_STATES.has(state);
}
function partInput(part: MessagePartValue): Record<string, unknown> | undefined {
  return "input" in part && part.input !== null && typeof part.input === "object"
    ? (part.input as Record<string, unknown>)
    : undefined;
}
function partOutput(part: MessagePartValue): Record<string, unknown> | undefined {
  return "output" in part && part.output !== null && typeof part.output === "object"
    ? (part.output as Record<string, unknown>)
    : undefined;
}
function partToolName(part: MessagePartValue): string | undefined {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : undefined;
}

function isDocsToolPart(part: MessagePartValue): boolean {
  if (part.type === "tool-renderVisualization" || part.type === "tool-suggestNext") return false;
  if (part.type === "dynamic-tool") return part.toolName !== "suggestNext";
  return part.type.startsWith("tool-");
}

function containsQuiz(part: MessagePartValue): boolean {
  if (part.type !== "tool-renderVisualization") return false;
  const spec = normalizeSpec(partInput(part)?.spec);
  return Boolean(
    spec && Object.values(spec.elements).some((element) => element.type === "Quiz"),
  );
}

function containsAcceptedQuiz(part: MessagePartValue): boolean {
  return (
    partState(part) === "output-available" &&
    partOutput(part)?.ok === true &&
    containsQuiz(part)
  );
}

/** Consecutive documentation lookups read as one connected provenance trail. */
function groupMessageParts(parts: MessagePartValue[]): MessagePartGroup[] {
  const groups: MessagePartGroup[] = [];
  let quizReached = false;
  for (const [partIndex, part] of parts.entries()) {
    if (quizReached) continue;
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
      partToolName(part) === "suggestNext";
    if (visible) {
      groups.push({ kind: "part", part, partIndex });
      if (containsAcceptedQuiz(part)) quizReached = true;
    }
  }
  return groups;
}

/** The `suggestNext` chips carried by one assistant message, if any. */
function chipsFromMessage(message: UIMessage): NextChip[] {
  for (const part of message.parts) {
    if (partToolName(part) !== "suggestNext") continue;
    const rawChips = partInput(part)?.chips;
    if (!Array.isArray(rawChips)) continue;
    const chips = rawChips.filter(
      (c): c is NextChip =>
        !!c && typeof c === "object" && typeof (c as { label?: unknown }).label === "string"
    );
    if (chips.length) return chips;
  }
  return [];
}

/** Collapse duplicate-id messages. A resumed run (or a persisted turn read back
 * on remount) can reappear with the same id; keep each id's first position but
 * its latest content, so React keys stay unique and we never render or persist
 * the same turn twice. */
function dedupeById(messages: UIMessage[]): UIMessage[] {
  const latest = new Map<string, UIMessage>();
  for (const message of messages) latest.set(message.id, message);
  const seen = new Set<string>();
  const out: UIMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    const newest = latest.get(message.id);
    if (newest) out.push(newest);
  }
  return out;
}

/** A short sidebar title from the first user message — ChatGPT/Claude-style. */
function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 47).trimEnd()}…` : clean;
}

type ChatRuntime = {
  chat: AIChat<UIMessage>;
  transport: TriggerChatTransport;
  invalidated: boolean;
  lastUsedAt: number;
};

// Keep each active runtime alive across sidebar navigation. An in-flight turn
// can then finish in the background and persist its answer instead of being
// cancelled or discarded when its route component unmounts.
const chatRuntimes = new Map<string, ChatRuntime>();
const MAX_SETTLED_CHAT_RUNTIMES = 12;

function runtimeIsActive(runtime: ChatRuntime): boolean {
  return runtime.chat.status === "submitted" || runtime.chat.status === "streaming";
}

function evictSettledRuntimes(maxSize: number): void {
  if (chatRuntimes.size <= maxSize) return;
  const candidates = [...chatRuntimes.entries()]
    .filter(([, runtime]) => !runtimeIsActive(runtime))
    .sort(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt);

  for (const [id, runtime] of candidates) {
    if (chatRuntimes.size <= maxSize) break;
    runtime.transport.dispose();
    chatRuntimes.delete(id);
  }
}

/** Stop and invalidate a deleted chat before removing its persisted records. */
export async function discardChatRuntime(chatId: string): Promise<void> {
  const runtime = chatRuntimes.get(chatId);
  if (!runtime) return;
  runtime.invalidated = true;
  chatRuntimes.delete(chatId);
  try {
    if (runtimeIsActive(runtime)) await runtime.chat.stop();
  } catch (error) {
    // Deletion should still remove local records if stopping a broken stream
    // fails. Invalidation prevents every persistence path from recreating it.
    console.error("Could not stop the deleted chat runtime", error);
  } finally {
    runtime.transport.dispose();
  }
}

function getChatRuntime(
  chatId: string,
  initialMessages: UIMessage[],
  initialSession: ChatSessionPersistedState | null,
): ChatRuntime {
  const existing = chatRuntimes.get(chatId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing;
  }

  // Make room only by evicting settled conversations. Active background turns
  // remain cached until their streams finish.
  evictSettledRuntimes(MAX_SETTLED_CHAT_RUNTIMES - 1);

  let runtime: ChatRuntime | undefined;
  const transport = new TriggerChatTransport({
    task: "trigger-chat-agent",
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    sessions: initialSession ? { [chatId]: initialSession } : undefined,
    onSessionChange: (changedChatId, session) => {
      if (runtime?.invalidated) return;
      void saveSession(changedChatId, session).catch((error) => {
        console.error("Could not persist the local chat session", error);
      });
    },
  });
  const chat = new AIChat<UIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: ({ messages }) => {
      if (runtime && !runtime.invalidated && messages.length > 0) {
        void saveMessages(chatId, dedupeById(messages)).catch((error) => {
          console.error("Could not persist the completed chat", error);
        });
      }
      queueMicrotask(() => evictSettledRuntimes(MAX_SETTLED_CHAT_RUNTIMES));
    },
  });
  runtime = {
    chat,
    transport,
    invalidated: false,
    lastUsedAt: Date.now(),
  };
  chatRuntimes.set(chatId, runtime);
  return runtime;
}

export function Chat({
  chatId,
  initialMessages,
  initialSession,
}: {
  chatId: string;
  initialMessages: UIMessage[];
  initialSession: ChatSessionPersistedState | null;
}) {
  const runtimeRef = useRef<ChatRuntime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = getChatRuntime(chatId, initialMessages, initialSession);
  }
  const { chat } = runtimeRef.current;

  const { messages, sendMessage, stop, status, error, regenerate, clearError } =
    useChat({
      chat,
      resume: initialSession?.isStreaming === true,
    });
  const [input, setInput] = useState("");
  const [blockingQuizIds, setBlockingQuizIds] = useState<Set<string>>(
    () => new Set(),
  );
  const reportQuizBlocking = useCallback((quizId: string, blocked: boolean) => {
    setBlockingQuizIds((current) => {
      const next = new Set(current);
      if (blocked) next.add(quizId);
      else next.delete(quizId);
      return next.size === current.size && [...next].every((id) => current.has(id))
        ? current
        : next;
    });
  }, []);
  const quizGateValue = useMemo(
    () => ({ chatId, reportBlocking: reportQuizBlocking }),
    [chatId, reportQuizBlocking],
  );
  const reduce = useReducedMotion();
  const busy = status === "submitted" || status === "streaming";
  const quizBlocked = blockingQuizIds.size > 0;

  // Everything below reads from the deduped list: a resumed/persisted turn can
  // come back with a duplicate id, which collides React keys and would persist
  // the same turn twice.
  const items = useMemo(() => dedupeById(messages), [messages]);

  // Persist the transcript to the device-local store when a turn settles (not
  // per-token). No server DB — this is what lets a refresh re-render the thread.
  useEffect(() => {
    if (!runtimeRef.current?.invalidated && items.length > 0 && !busy) {
      void saveMessages(chatId, items).catch((error) => {
        console.error("Could not persist the local chat", error);
      });
    }
  }, [chatId, items, busy]);

  // Flush the latest visible transcript when leaving. The cached runtime keeps
  // an in-flight turn alive and its onFinish persists the completed answer.
  const latestMessagesRef = useRef(items);
  useEffect(() => {
    latestMessagesRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      if (
        !runtimeRef.current?.invalidated &&
        latestMessagesRef.current.length > 0
      ) {
        void saveMessages(chatId, latestMessagesRef.current).catch((error) => {
          console.error("Could not persist the local chat on navigation", error);
        });
      }
    };
  }, [chatId]);

  // Title the chat once, from its first user message, into the device-local
  // index the sidebar reads. Once per mount (ref-guarded) so it never churns.
  const titledRef = useRef(false);
  useEffect(() => {
    if (titledRef.current || items.length === 0) return;
    const firstUser = items.find((message) => message.role === "user");
    if (!firstUser) return;
    let text = "";
    for (const part of firstUser.parts) if (part.type === "text") text += part.text;
    text = text.trim();
    if (!text) return;
    void setTitle(chatId, deriveTitle(text)).catch((error) => {
      console.error("Could not persist the local chat title", error);
    });
    titledRef.current = true;
  }, [chatId, items]);

  // Next-step chips: derived from the current last assistant turn, but kept
  // sticky because the trailing `suggestNext` tool part is dropped when the turn
  // finalizes. Keying the sticky copy to the assistant message id means a
  // finished turn keeps its chips, while a NEW turn shows none until its own
  // suggestNext streams — so the previous turn's chips can't flash back.
  const lastAssistant = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].role === "assistant") return items[i];
    }
    return undefined;
  }, [items]);
  const streamingChips = useMemo(
    () => (lastAssistant ? chipsFromMessage(lastAssistant) : []),
    [lastAssistant]
  );
  const [stickyChips, setStickyChips] = useState<{ id: string; chips: NextChip[] } | null>(null);
  useEffect(() => {
    if (lastAssistant && streamingChips.length) {
      setStickyChips({ id: lastAssistant.id, chips: streamingChips });
    }
    // Fire only when the turn or the chip count changes, not on every token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistant?.id, streamingChips.length]);
  const chips =
    stickyChips && lastAssistant && stickyChips.id === lastAssistant.id ? stickyChips.chips : [];
  const showExplainSimply = Boolean(lastAssistant) && !busy && !quizBlocked;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastRowRef = useRef<HTMLDivElement>(null);
  // Whether the view should stick to the bottom as the answer grows. Armed on
  // send, dropped when the reader scrolls up to read, re-armed at the bottom.
  const followRef = useRef(true);

  // On send, bring the new turn into view.
  useEffect(() => {
    if (items[items.length - 1]?.role === "user") {
      followRef.current = true;
      lastRowRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Follow the answer as it streams. A ResizeObserver on the content tracks
  // growth (message count doesn't change while text streams). Only genuine user
  // gestures (wheel/touch) disarm the follow — we deliberately do NOT listen to
  // `scroll`, because our own programmatic scrolls fire it too and would flip
  // the pin off mid-animation.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = scroller?.firstElementChild;
    if (!scroller || !content) return;

    const syncFollow = () => {
      followRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    };
    scroller.addEventListener("wheel", syncFollow, { passive: true });
    scroller.addEventListener("touchmove", syncFollow, { passive: true });

    const observer = new ResizeObserver(() => {
      if (followRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);

    return () => {
      scroller.removeEventListener("wheel", syncFollow);
      scroller.removeEventListener("touchmove", syncFollow);
      observer.disconnect();
    };
  }, []);

  // The page shell itself is fixed, so capture every vertical wheel gesture
  // outside the sidebar and apply it to the thread. Handling the thread itself
  // here too avoids relying on browser scroll chaining over nested cards.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const forwardWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest("[data-chat-sidebar]")) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest("pre, .react-flow, [data-native-wheel]")
      ) {
        return;
      }

      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? scroller.clientHeight
            : 1;
      scroller.scrollTop += event.deltaY * scale;
      followRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
      event.preventDefault();
    };

    document.addEventListener("wheel", forwardWheel, {
      capture: true,
      passive: false,
    });
    return () =>
      document.removeEventListener("wheel", forwardWheel, { capture: true });
  }, []);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || quizBlocked) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <QuizGateContext.Provider value={quizGateValue}>
      {/* Side rules define the reading column, so overflowing content reads as
          clipped by a boundary. `relative` anchors the floating composer. */}
      <main className="relative mx-auto flex h-dvh w-full max-w-[52rem] flex-col border-x border-grid-dimmed px-4 sm:px-6">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-grid-dimmed">
        <div className="ml-12 flex items-center gap-2.5 md:ml-0">
          <TriggerLogo className="size-7" />
          <AgentWordmark className="text-xl" />
        </div>
        <span className="font-mono text-2xs uppercase tracking-widest text-charcoal-500">
          interactive guide
        </span>
      </header>

      {/* The thread runs the full height and passes under the composer. Bottom
          padding clears the dock; the dock owns the fade and chips own blur. */}
      <div
        ref={scrollerRef}
        className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-44 pt-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700 sm:-mx-6 sm:pt-8"
      >
        {/* Single child: what the ResizeObserver measures to follow the stream.
            The scroller reaches the column rules so its bar does not cover the
            content; restore the reading-column padding on this inner child. */}
        <div className="space-y-8 px-4 sm:px-6">
          {items.length === 0 ? (
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
            items.map((message, i) => (
              <div
                key={message.id}
                ref={i === items.length - 1 ? lastRowRef : undefined}
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

          {busy && <Thinking reduce={!!reduce} />}

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
        {(chips.length > 0 || showExplainSimply) && !busy && !quizBlocked && (
          <div className="pointer-events-auto -mx-4 mb-3 overflow-hidden sm:-mx-6">
            {/* The rail reaches the column rules, so overflow hard-clips at the
                established borders. Left padding keeps its first chip aligned. */}
            <div className="flex gap-2 overflow-x-auto pb-1 pl-4 [scrollbar-width:none] sm:pl-6 [&::-webkit-scrollbar]:hidden">
              {showExplainSimply && (
                <button
                  type="button"
                  onClick={() => submit("Simplify")}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-apple-500/40 bg-charcoal-950/70 px-3 py-2 text-left text-xs font-medium leading-4 text-bright backdrop-blur-md transition-colors duration-150 hover:bg-apple-500/10"
                >
                  <Sparkles className="size-3.5 shrink-0 text-apple-500" />
                  Simplify
                </button>
              )}
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
              disabled={quizBlocked}
              placeholder={
                quizBlocked
                  ? "Answer the quiz to continue…"
                  : "Ask how Trigger.dev works…"
              }
              aria-label="Message Trigger.dev guide"
              className="min-w-0 flex-1 border-0 bg-transparent px-0 py-2.5 text-base text-foreground caret-apple-500 outline-none ring-0 placeholder:text-charcoal-500 focus-visible:outline-none"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-charcoal-800 text-bright transition-colors duration-150 hover:bg-charcoal-700"
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || quizBlocked}
                className="group flex size-10 shrink-0 items-center justify-center rounded-lg bg-apple-500 text-charcoal-900 transition-colors duration-150 hover:bg-apple-400 disabled:bg-transparent disabled:text-charcoal-500"
                aria-label="Send"
              >
                <ArrowUp className="size-4 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5" />
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-2xs leading-4 text-charcoal-500">
            Answers cite the live Trigger.dev docs where available — follow the links to check.
          </p>
        </form>
      </footer>
      </main>
    </QuizGateContext.Provider>
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
            visualizationKey={`${message.id}:${group.partIndex}`}
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
  const toolName = partToolName(part) ?? "documentation";
  const input = partInput(part);
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
  // "Settled" includes output-error — a failed remote lookup must not leave the
  // header on "Searching" with a pinging dot forever.
  const complete = parts.every(isSettled);

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
          const state = partState(part);
          const done = state === "output-available";
          const errored = state === "output-error";
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
              {errored ? (
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0 text-warning"
                  aria-label="Lookup failed"
                />
              ) : done ? (
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
  visualizationKey,
  onPick,
  busy,
  reduce,
}: {
  part: UIMessage["parts"][number];
  visualizationKey: string;
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
    const state = partState(part);
    const output = partOutput(part);
    const failed = state === "output-error" || output?.ok === false;
    const spec = state === "input-streaming" ? null : normalizeSpec(partInput(part)?.spec);
    // A rejected/failed spec settles to a static notice instead of spinning
    // forever; the model's retry arrives as its own later part with its own status.
    if (failed) return <ToolStatus label="Couldn't draw that." />;
    if (!spec) return <ToolStatus label="Drawing…" spinning />;
    return <Visualization spec={spec} instanceKey={visualizationKey} />;
  }

  // suggestNext chips render docked above the composer (they don't survive the
  // turn's finalization inline), so nothing is drawn here. Every other tool part
  // is a docs lookup, which groupMessageParts routes into DocsToolChain — so it
  // never reaches here, and there's nothing else to draw.
  return null;
}

function Thinking({ reduce }: { reduce: boolean }) {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="flex items-center gap-3 py-1 text-dimmed">
        <ThinkingOrb reduced={reduce} />
        <span className="font-mono text-2xs uppercase tracking-widest">
          Thinking…
        </span>
      </div>
    </div>
  );
}

function ToolStatus({ label, spinning }: { label: string; spinning?: boolean }) {
  return (
    <div className="my-1 flex items-center gap-1.5 text-xs text-dimmed">
      <span
        className={`size-1.5 rounded-full bg-apple-500 ${spinning ? "animate-pulse" : ""}`}
      />
      {label}
    </div>
  );
}
