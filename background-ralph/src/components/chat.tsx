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
  | { type: "approval_response"; id: string; action: string };

// Parse NDJSON output into structured message blocks
function parseMessages(raw: string): MessageBlock[] {
  const lines = raw.split("\n").filter(Boolean);
  const blocks: MessageBlock[] = [];
  const toolBlocks = new Map<
    string,
    { name: string; input: string; complete: boolean }
  >();
  const seenApprovals = new Set<string>();

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
          flushThinking();
          flushText();
          blocks.push({
            type: "approval_response",
            id: msg.id,
            action: msg.action,
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
}: {
  tokenId: string;
  publicAccessToken: string;
  question: string;
  responded: boolean;
  createdAt?: number;
  timeoutMs?: number;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const { complete } = useWaitToken(tokenId, {
    accessToken: publicAccessToken,
  });

  async function handleAction(
    action: "continue" | "stop" | "approve_complete"
  ) {
    setIsSubmitting(true);
    setError(undefined);
    try {
      await complete({ action });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setIsSubmitting(false);
    }
  }

  const isDisabled = isSubmitting || responded;

  return (
    <div className="my-3 p-3 border border-yellow-500/30 bg-yellow-500/5 rounded-md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-slate-700">{question}</p>
        {!responded && (
          <Countdown createdAt={createdAt} timeoutMs={timeoutMs} />
        )}
      </div>
      {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => handleAction("continue")}
          disabled={isDisabled}
          className="h-7 text-[11px] px-3"
        >
          {isSubmitting ? "..." : "Continue"}
        </Button>
        <Button
          size="sm"
          onClick={() => handleAction("approve_complete")}
          disabled={isDisabled}
          className="h-7 text-[11px] px-3 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? "..." : "Approve & Complete"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("stop")}
          disabled={isDisabled}
          className="h-7 text-[11px] px-3"
        >
          {isSubmitting ? "..." : "Stop"}
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
}: {
  tokenId: string;
  publicAccessToken: string;
  question: string;
  prd: Prd;
  responded: boolean;
  createdAt?: number;
  timeoutMs?: number;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const { complete } = useWaitToken(tokenId, {
    accessToken: publicAccessToken,
  });

  async function handleApprove() {
    setIsSubmitting(true);
    setError(undefined);
    try {
      await complete({ action: "approve_prd", prd });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setIsSubmitting(false);
    }
  }

  const isDisabled = isSubmitting || responded;

  return (
    <div className="my-3 p-3 border border-blue-500/30 bg-blue-500/5 rounded-md">
      <div className="flex justify-between flex-col items-start gap-3">
        {!responded && (
          <div className="flex gap-3">
            <p className="text-[11px] text-slate-700">
              {" "}
              Waiting for approval:{" "}
              <Countdown createdAt={createdAt} timeoutMs={timeoutMs} />
            </p>
          </div>
        )}

        <p className="text-[12px] text-slate-700">{question}</p>
        {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={isDisabled}
          className="h-7 text-[11px] px-3 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? "Starting..." : "Approve & Start"}
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
  });

  // Subscribe to status stream to get PRD
  const { parts: rawStatusParts } = useRealtimeStream(statusStream, runId, {
    accessToken,
  });

  // Parse status updates and derive PRD
  const currentPrd = useMemo(() => {
    if (!rawStatusParts) return null;
    let prd: Prd | null = null;
    for (const part of rawStatusParts) {
      try {
        const status = JSON.parse(part) as StatusUpdate;
        if (status.type === "prd_generated" && status.prd) prd = status.prd;
        if (status.type === "prd_review" && status.prd && !prd)
          prd = status.prd;
      } catch {
        // Ignore parse errors
      }
    }
    return prd;
  }, [rawStatusParts]);

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

  if (blocks.length === 0) {
    return (
      <div className="p-4 text-[11px] text-slate-600">Waiting for agent...</div>
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
              return (
                <div
                  key={i}
                  className="text-[11px] font-mono text-slate-800 leading-relaxed whitespace-pre-wrap"
                >
                  {block.content}
                </div>
              );

            case "text":
              return (
                <div
                  key={i}
                  className="prose prose-sm max-w-none text-[13px] leading-relaxed prose-pre:bg-slate-100 prose-pre:border prose-pre:border-slate-200 prose-pre:text-[11px] prose-code:text-slate-800"
                >
                  <Streamdown>{block.content}</Streamdown>
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
              if (block.variant === "prd" && currentPrd) {
                return (
                  <PrdApprovalButton
                    key={block.id}
                    tokenId={block.tokenId}
                    publicAccessToken={block.publicAccessToken}
                    question={block.question}
                    prd={currentPrd}
                    responded={respondedApprovals.has(block.id)}
                    createdAt={block.createdAt}
                    timeoutMs={block.timeoutMs}
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
          }
        })}
      </div>
    </div>
  );
}
