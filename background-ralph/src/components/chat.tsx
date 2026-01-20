"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useRealtimeStream, useWaitToken } from "@trigger.dev/react-hooks";
import { Streamdown } from "streamdown";
import {
  agentOutputStream,
  statusStream,
  type ChatMessage,
  type Prd,
  type StatusUpdate,
} from "@/trigger/streams";
import { Button } from "@/components/ui/button";

type Props = {
  runId: string;
  accessToken: string;
};

// Parsed message block for rendering
type MessageBlock =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string }
  | { type: "status"; message: string; phase: "cloning" | "exploring" | "planning" }
  | { type: "tool"; id: string; name: string; input: string; complete: boolean }
  | {
      type: "story_separator";
      storyNum: number;
      totalStories: number;
      title: string;
    }
  | {
      type: "approval";
      id: string;
      tokenId: string;
      publicAccessToken: string;
      question: string;
      variant: "story" | "prd";
      createdAt?: number;
      timeoutMs?: number;
    }
  | { type: "approval_response"; id: string; action: string }
  | { type: "complete"; prUrl?: string; prTitle?: string; branchUrl?: string; error?: string };

// Parse NDJSON output into structured message blocks
function parseMessages(raw: string): MessageBlock[] {
  const lines = raw.split("\n").filter(Boolean);
  const blocks: MessageBlock[] = [];
  const toolBlocks = new Map<
    string,
    { name: string; input: string; complete: boolean }
  >();
  const seenApprovals = new Set<string>();
  const seenStatuses = new Set<string>(); // Dedupe status messages

  let currentThinking = "";
  let currentText = "";

  const flushThinking = () => {
    if (currentThinking) {
      blocks.push({ type: "thinking", content: currentThinking });
      currentThinking = "";
    }
  };

  const flushText = () => {
    if (currentText) {
      blocks.push({ type: "text", content: currentText });
      currentText = "";
    }
  };

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as ChatMessage;

      switch (msg.type) {
        case "thinking":
          flushText();
          currentThinking += msg.delta;
          break;

        case "text":
          flushThinking();
          currentText += msg.delta;
          break;

        case "status":
          // Dedupe status messages by phase+message
          const statusKey = `${msg.phase}:${msg.message}`;
          if (seenStatuses.has(statusKey)) break;
          seenStatuses.add(statusKey);
          flushThinking();
          flushText();
          blocks.push({
            type: "status",
            message: msg.message,
            phase: msg.phase,
          });
          break;

        case "tool_start":
          flushThinking();
          flushText();
          toolBlocks.set(msg.id, {
            name: msg.name,
            input: "",
            complete: false,
          });
          break;

        case "tool_input":
          const tool = toolBlocks.get(msg.id);
          if (tool) {
            tool.input += msg.delta;
          }
          break;

        case "tool_end":
          const endTool = toolBlocks.get(msg.id);
          if (endTool) {
            endTool.complete = true;
            blocks.push({
              type: "tool",
              id: msg.id,
              name: endTool.name,
              input: endTool.input,
              complete: true,
            });
            toolBlocks.delete(msg.id);
          }
          break;

        case "story_separator":
          // Dedupe separators by story number
          const sepKey = `story-${msg.storyNum}`;
          if (seenStatuses.has(sepKey)) break;
          seenStatuses.add(sepKey);
          flushThinking();
          flushText();
          blocks.push({
            type: "story_separator",
            storyNum: msg.storyNum,
            totalStories: msg.totalStories,
            title: msg.title,
          });
          break;

        case "approval":
          // Dedupe approvals by ID
          if (seenApprovals.has(msg.id)) break;
          seenApprovals.add(msg.id);
          flushThinking();
          flushText();
          blocks.push({
            type: "approval",
            id: msg.id,
            tokenId: msg.tokenId,
            publicAccessToken: msg.publicAccessToken,
            question: msg.question,
            variant: msg.variant,
            createdAt: msg.createdAt,
            timeoutMs: msg.timeoutMs,
          });
          break;

        case "approval_response":
          // Dedupe responses by ID (approval ID reused)
          const respKey = `resp-${msg.id}`;
          if (seenApprovals.has(respKey)) break;
          seenApprovals.add(respKey);
          flushThinking();
          flushText();
          blocks.push({
            type: "approval_response",
            id: msg.id,
            action: msg.action,
          });
          break;

        case "complete":
          flushThinking();
          flushText();
          blocks.push({
            type: "complete",
            prUrl: msg.prUrl,
            prTitle: msg.prTitle,
            branchUrl: msg.branchUrl,
            error: msg.error,
          });
          break;
      }
    } catch {
      // Invalid JSON line, skip
    }
  }

  // Flush remaining
  flushThinking();
  flushText();

  // Add incomplete tool blocks
  Array.from(toolBlocks.entries()).forEach(([id, tool]) => {
    blocks.push({
      type: "tool",
      id,
      name: tool.name,
      input: tool.input,
      complete: false,
    });
  });

  return blocks;
}

// Tool icon based on name
function getToolIcon(name: string): string {
  switch (name) {
    case "Read":
      return "📖";
    case "Write":
      return "✏️";
    case "Edit":
      return "📝";
    case "Bash":
      return "⚡";
    case "Grep":
      return "🔍";
    case "Glob":
      return "📁";
    default:
      return "🔧";
  }
}

// Extract file path or command from tool input
function getToolSummary(name: string, input: string): string {
  try {
    const parsed = JSON.parse(input);
    if (name === "Bash" && parsed.command) {
      return (
        parsed.command.slice(0, 60) + (parsed.command.length > 60 ? "..." : "")
      );
    }
    if (parsed.file_path) {
      return parsed.file_path.split("/").pop() ?? parsed.file_path;
    }
    if (parsed.path) {
      return parsed.path.split("/").pop() ?? parsed.path;
    }
    if (parsed.pattern) {
      return parsed.pattern;
    }
  } catch {
    // Incomplete JSON, try to extract path
    const pathMatch = input.match(/"(?:file_)?path":\s*"([^"]+)/);
    if (pathMatch) return pathMatch[1].split("/").pop() ?? pathMatch[1];
    const cmdMatch = input.match(/"command":\s*"([^"]+)/);
    if (cmdMatch) return cmdMatch[1].slice(0, 60);
  }
  return "";
}

// Format remaining time as "Xh Ym"
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Countdown display component
function Countdown({
  createdAt,
  timeoutMs,
}: {
  createdAt?: number;
  timeoutMs?: number;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!createdAt || !timeoutMs) return;
    const deadline = createdAt + timeoutMs;

    function update() {
      setRemaining(Math.max(0, deadline - Date.now()));
    }
    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [createdAt, timeoutMs]);

  if (remaining === null) return null;

  return (
    <span className="text-[10px] text-green-600 font-mono">
      {formatTimeRemaining(remaining)} remaining
    </span>
  );
}

// Inline approval buttons for story approvals
function StoryApprovalButtons({
  tokenId,
  publicAccessToken,
  question,
  responded,
  createdAt,
  timeoutMs,
  remainingStories,
}: {
  tokenId: string;
  publicAccessToken: string;
  question: string;
  responded: boolean;
  createdAt?: number;
  timeoutMs?: number;
  remainingStories?: number;
}) {
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string>();
  const { complete } = useWaitToken(tokenId, {
    accessToken: publicAccessToken,
  });

  async function handleAction(
    action: "continue" | "stop" | "approve_complete"
  ) {
    setSubmittedAction(action);
    setError(undefined);
    try {
      await complete({ action });
      setIsCompleted(true); // Mark as completed locally
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmittedAction(null);
    }
  }

  // Hide when responded - approval_response block will show the message
  if (responded || isCompleted) {
    return null;
  }

  // Show submitting state
  if (submittedAction) {
    const message = submittedAction === "approve_complete"
      ? `Yoloing remaining stories...`
      : submittedAction === "stop"
      ? "Stopping..."
      : "Continuing...";
    return (
      <div className="my-3 p-3 border border-blue-500/30 bg-blue-500/5 rounded-md">
        <div className="flex items-center gap-2">
          <span className="animate-spin text-[14px]">🍩</span>
          <p className="text-[12px] text-blue-700">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 p-3 border border-yellow-500/30 bg-yellow-500/5 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-700">{question}</p>
        <Countdown createdAt={createdAt} timeoutMs={timeoutMs} />
      </div>
      <p className="text-[10px] text-slate-500 italic">
        Next Story = I&apos;ll do one more, then ask again. Yolo = I&apos;ll finish everything without stopping!
      </p>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleAction("continue")}
          className="h-7 text-[11px] px-3"
        >
          Next story
        </Button>
        <Button
          size="sm"
          onClick={() => handleAction("approve_complete")}
          className="h-7 text-[11px] px-3 bg-green-600 hover:bg-green-700"
        >
          Yolo remaining{remainingStories ? ` ${remainingStories}` : ""}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("stop")}
          className="h-7 text-[11px] px-3"
        >
          Stop
        </Button>
      </div>
    </div>
  );
}

// Inline approval button for PRD review
function PrdApprovalButton({
  tokenId,
  publicAccessToken,
  question,
  prd,
  responded,
  createdAt,
  timeoutMs,
  storyCount,
}: {
  tokenId: string;
  publicAccessToken: string;
  question: string;
  prd: Prd | null;
  responded: boolean;
  createdAt?: number;
  timeoutMs?: number;
  storyCount: number;
}) {
  const [submittedAction, setSubmittedAction] = useState<"start" | "yolo" | null>(null);
  const [error, setError] = useState<string>();
  const { complete } = useWaitToken(tokenId, {
    accessToken: publicAccessToken,
  });

  const [isCompleted, setIsCompleted] = useState(false);

  // Auto-refresh if PRD doesn't load within 2 seconds
  useEffect(() => {
    if (prd) return; // PRD loaded, no need to refresh
    const timer = setTimeout(() => {
      window.location.reload();
    }, 2000);
    return () => clearTimeout(timer);
  }, [prd]);

  async function handleApprove(yolo: boolean) {
    if (!prd) return; // Wait for PRD to load
    setSubmittedAction(yolo ? "yolo" : "start");
    setError(undefined);
    try {
      await complete({ action: "approve_prd", prd, yolo });
      setIsCompleted(true); // Mark as completed locally
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmittedAction(null);
    }
  }

  // Show loading state while waiting for PRD
  if (!prd) {
    return (
      <div className="my-3 p-3 border border-blue-500/30 bg-blue-500/5 rounded-md">
        <div className="flex items-center gap-2">
          <span className="animate-spin text-[14px]">🍩</span>
          <p className="text-[12px] text-blue-700">Loading PRD...</p>
        </div>
      </div>
    );
  }

  // Hide when responded - approval_response block will show the message
  if (responded || isCompleted) {
    return null;
  }

  // Show submitting state (waiting for response)
  if (submittedAction) {
    return (
      <div className="my-3 p-3 border border-blue-500/30 bg-blue-500/5 rounded-md">
        <div className="flex items-center gap-2">
          <span className="animate-spin text-[14px]">🍩</span>
          <p className="text-[12px] text-blue-700">
            {submittedAction === "yolo" ? `Starting all ${storyCount} stories...` : "Starting..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 p-3 border border-blue-500/30 bg-blue-500/5 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-700">{question}</p>
        <Countdown createdAt={createdAt} timeoutMs={timeoutMs} />
      </div>
      <p className="text-[10px] text-slate-500 italic">
        Check the PRD in the right panel. Start = I&apos;ll ask after each story. Yolo = I&apos;ll do everything!
      </p>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleApprove(false)}
          className="h-7 text-[11px] px-3"
        >
          Start
        </Button>
        <Button
          size="sm"
          onClick={() => handleApprove(true)}
          className="h-7 text-[11px] px-3 bg-green-600 hover:bg-green-700"
        >
          Yolo {storyCount} stories
        </Button>
      </div>
    </div>
  );
}

function ToolBlock({
  name,
  input,
  complete,
}: {
  name: string;
  input: string;
  complete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = getToolSummary(name, input);

  return (
    <div className="my-2 border border-slate-200 rounded bg-slate-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-[12px]">{getToolIcon(name)}</span>
        <span className="text-[12px] font-medium text-slate-700">{name}</span>
        {summary && (
          <span className="text-[11px] text-slate-500 font-mono truncate flex-1">
            {summary}
          </span>
        )}
        {!complete && (
          <span className="text-[10px] text-blue-400 animate-pulse">
            running...
          </span>
        )}
        <span className="text-[10px] text-slate-400">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && input && (
        <pre className="px-3 py-2 text-[10px] font-mono text-slate-700 border-t border-slate-200 overflow-x-auto max-h-[200px] overflow-y-auto">
          {input}
        </pre>
      )}
    </div>
  );
}

export function Chat({ runId, accessToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const { parts: outputParts } = useRealtimeStream(agentOutputStream, runId, {
    accessToken,
    timeoutInSeconds: 600, // Max allowed by API
  });

  // Subscribe to status stream to get PRD
  const { parts: rawStatusParts } = useRealtimeStream(statusStream, runId, {
    accessToken,
    timeoutInSeconds: 600,
  });

  // Track PRD in state to ensure re-renders when it arrives
  const [currentPrd, setCurrentPrd] = useState<Prd | null>(null);
  const [planningStatus, setPlanningStatus] = useState<string | null>(null);

  // Update PRD state when status stream updates
  useEffect(() => {
    if (!rawStatusParts || rawStatusParts.length === 0) return;

    let foundPrd: Prd | null = null;
    let foundPlanning: string | null = null;

    for (const part of rawStatusParts) {
      try {
        const status = JSON.parse(part) as StatusUpdate;
        if (status.type === "prd_generated" && status.prd) foundPrd = status.prd;
        if (status.type === "prd_review" && status.prd && !foundPrd) foundPrd = status.prd;
        if (status.type === "prd_planning" || status.type === "exploring" || status.type === "cloning") {
          foundPlanning = status.message;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Only update if PRD changed (avoid unnecessary re-renders)
    if (foundPrd && !currentPrd) {
      setCurrentPrd(foundPrd);
    }
    if (foundPlanning !== planningStatus) {
      setPlanningStatus(foundPlanning);
    }
  }, [rawStatusParts, rawStatusParts?.length, currentPrd, planningStatus]);

  const rawOutput = outputParts?.join("") ?? "";
  const blocks = useMemo(() => parseMessages(rawOutput), [rawOutput]);

  // Track which approvals have been responded to
  const respondedApprovals = useMemo(() => {
    const responded = new Set<string>();
    for (const block of blocks) {
      if (block.type === "approval_response") {
        responded.add(block.id);
      }
    }
    return responded;
  }, [blocks]);

  // Find the latest pending story approval for keyboard shortcuts
  const pendingStoryApproval = useMemo(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (
        block.type === "approval" &&
        block.variant === "story" &&
        !respondedApprovals.has(block.id)
      ) {
        return {
          tokenId: block.tokenId,
          publicAccessToken: block.publicAccessToken,
        };
      }
    }
    return null;
  }, [blocks, respondedApprovals]);


  // Auto-scroll when new content arrives (if not paused)
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [blocks, isAutoScroll]);

  // Pause auto-scroll on user scroll up
  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScroll(isAtBottom);
  }

  // Check if agent is actively working (not at waitpoint, not complete)
  const isWorking = useMemo(() => {
    if (blocks.length === 0) return true;
    const lastBlock = blocks[blocks.length - 1];
    // Not working if complete or at unanswered approval
    if (lastBlock.type === "complete") return false;
    if (lastBlock.type === "approval" && !respondedApprovals.has(lastBlock.id)) return false;
    return true;
  }, [blocks, respondedApprovals]);

  if (blocks.length === 0) {
    return (
      <div className="p-4 text-[11px] text-slate-600 flex items-center gap-2">
        <span className="animate-spin text-[12px]">🍩</span>
        {planningStatus ?? "Waiting for agent..."}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
          Agent
        </span>
        {!isAutoScroll && (
          <button
            onClick={() => setIsAutoScroll(true)}
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            Resume scroll
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {blocks.map((block, i) => {
          switch (block.type) {
            case "thinking":
              // Ralph's internal voice - mono, muted, italic
              return (
                <div
                  key={i}
                  className="text-[11px] font-mono italic text-slate-500 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-slate-200"
                >
                  {block.content}
                </div>
              );

            case "text":
              // System output - clear, normal voice
              return (
                <div
                  key={i}
                  className="prose prose-sm max-w-none text-[12px] leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-pre:bg-slate-100 prose-pre:border prose-pre:border-slate-200 prose-pre:text-[11px] prose-code:text-slate-700 prose-headings:text-[13px] prose-headings:font-semibold"
                >
                  <Streamdown>{block.content}</Streamdown>
                </div>
              );

            case "status":
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1 text-[11px] text-slate-600"
                >
                  <span className="animate-spin text-[12px]">🍩</span>
                  <span>{block.message}</span>
                </div>
              );

            case "tool":
              return (
                <ToolBlock
                  key={block.id}
                  name={block.name}
                  input={block.input}
                  complete={block.complete}
                />
              );

            case "story_separator":
              return (
                <div key={i} className="py-3 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-slate-600">
                    Story {block.storyNum}/{block.totalStories}: {block.title}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );

            case "approval":
              if (block.variant === "prd") {
                return (
                  <PrdApprovalButton
                    key={`${block.id}-${currentPrd ? "loaded" : "loading"}`}
                    tokenId={block.tokenId}
                    publicAccessToken={block.publicAccessToken}
                    question={block.question}
                    prd={currentPrd}
                    responded={respondedApprovals.has(block.id)}
                    createdAt={block.createdAt}
                    timeoutMs={block.timeoutMs}
                    storyCount={currentPrd?.stories.length ?? 0}
                  />
                );
              }
              return (
                <StoryApprovalButtons
                  key={block.id}
                  tokenId={block.tokenId}
                  publicAccessToken={block.publicAccessToken}
                  question={block.question}
                  responded={respondedApprovals.has(block.id)}
                  createdAt={block.createdAt}
                  timeoutMs={block.timeoutMs}
                />
              );

            case "approval_response":
              return (
                <div
                  key={i}
                  className="my-2 px-3 py-2 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded"
                >
                  ✓ {block.action}
                </div>
              );

            case "complete": {
              const isSuccess = block.prUrl || block.branchUrl;
              const isError = block.error;
              return (
                <div
                  key={i}
                  className={`my-4 p-4 rounded-md space-y-3 ${
                    isError
                      ? "bg-red-50 border border-red-200"
                      : isSuccess
                        ? "bg-yellow-50 border border-yellow-200"
                        : "bg-slate-50 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{isError ? "😿" : "🍩"}</span>
                    <span className={`text-[13px] font-medium ${
                      isError ? "text-red-800" : isSuccess ? "text-yellow-800" : "text-slate-700"
                    }`}>
                      {isError
                        ? "Uh oh, my cat's breath smells like cat food..."
                        : isSuccess
                          ? "We did it! You're my best friend!"
                          : "I made some changes but couldn't push them"}
                    </span>
                  </div>
                  {block.prUrl ? (
                    <a
                      href={block.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-medium bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span>Review PR</span>
                    </a>
                  ) : block.branchUrl ? (
                    <a
                      href={block.branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-medium bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded transition-colors"
                    >
                      <span>→</span>
                      <span>View Branch</span>
                    </a>
                  ) : block.error ? (
                    <div className="text-[11px] text-red-600 bg-red-100 border border-red-200 rounded px-3 py-2 whitespace-pre-wrap">
                      {block.error}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600">
                      Changes made locally (check GITHUB_TOKEN permissions)
                    </p>
                  )}
                </div>
              );
            }
          }
        })}
        {/* Working indicator at bottom */}
        {isWorking && (
          <div className="flex items-center gap-2 py-2 text-[11px] text-slate-500">
            <span className="animate-spin text-[12px]">🍩</span>
            <span>Ralph is working...</span>
          </div>
        )}
      </div>
    </div>
  );
}
