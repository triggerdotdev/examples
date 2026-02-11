"use client";

import type { CursorEvent, ToolCallEvent } from "@/lib/cursor-events";
import { getToolName, getToolArgs } from "@/lib/cursor-events";

function stripWorkspacePath(filePath: string, workspaceCwd?: string): string {
  if (workspaceCwd && filePath.startsWith(workspaceCwd)) {
    const stripped = filePath.slice(workspaceCwd.length);
    return stripped.startsWith("/") ? stripped.slice(1) : stripped;
  }
  const match = filePath.match(/\/tmp\/workspace-[^/]+\/(.+)/);
  return match?.[1] ?? filePath;
}

function ToolCallStarted({ event, workspaceCwd }: { event: ToolCallEvent; workspaceCwd?: string }) {
  const toolName = getToolName(event);
  const args = getToolArgs(event);

  switch (toolName) {
    case "writeToolCall":
    case "editToolCall":
    case "deleteToolCall": {
      const rawPath = (args.filePath as string) ?? (args.path as string) ?? "unknown";
      const filePath = stripWorkspacePath(rawPath, workspaceCwd);
      const prefix =
        toolName === "writeToolCall" ? "+" : toolName === "editToolCall" ? "~" : "-";
      const color =
        toolName === "writeToolCall"
          ? "text-emerald-400"
          : toolName === "editToolCall"
            ? "text-teal-300"
            : "text-rose-400";
      const bg =
        toolName === "writeToolCall"
          ? "bg-emerald-500/8"
          : toolName === "editToolCall"
            ? "bg-teal-500/8"
            : "bg-rose-500/8";
      return (
        <div className={`flex items-center gap-2.5 py-1 px-2.5 rounded-md ${bg} -mx-1`}>
          <span className={`font-mono font-bold text-xs ${color} w-3 text-center shrink-0`}>
            {prefix}
          </span>
          <span className="text-sm font-mono text-text">{filePath}</span>
        </div>
      );
    }
    case "shellToolCall": {
      const command = (args.command as string) ?? (args.cmd as string) ?? "";
      return (
        <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-md bg-white/[0.02] -mx-1">
          <span className="text-xs font-mono shrink-0 text-accent">$</span>
          <span className="text-sm font-mono text-muted">{command}</span>
        </div>
      );
    }
    case "readToolCall":
    case "grepToolCall":
    case "lsToolCall":
    case "globToolCall": {
      const rawTarget =
        (args.filePath as string) ??
        (args.path as string) ??
        (args.pattern as string) ??
        "";
      const target = stripWorkspacePath(rawTarget, workspaceCwd);
      return (
        <div className="py-0.5">
          <span className="text-xs font-mono text-dim">
            {toolName.replace("ToolCall", "")}
          </span>
          {target && (
            <span className="text-xs font-mono text-dim ml-1.5">{target}</span>
          )}
        </div>
      );
    }
    default:
      return (
        <div className="py-0.5">
          <span className="text-xs font-mono text-dim">{toolName}</span>
        </div>
      );
  }
}

function ToolCallCompleted({ event }: { event: ToolCallEvent }) {
  const toolName = getToolName(event);
  if (toolName === "unknown") return null;

  const toolData = event.tool_call[toolName];
  const result = toolData?.result;
  const hasError = result && "rejected" in result;

  if (hasError) {
    return (
      <div className="py-0.5 px-2.5 -mx-1">
        <span className="text-xs font-mono text-red-400/60">
          ✗ {toolName.replace("ToolCall", "")} failed
        </span>
      </div>
    );
  }

  return null;
}

export function CursorEventRow({
  event,
  workspaceCwd,
}: {
  event: CursorEvent;
  workspaceCwd?: string;
}) {
  return (
    <div className="animate-event-enter">
      <CursorEventContent event={event} workspaceCwd={workspaceCwd} />
    </div>
  );
}

function CursorEventContent({
  event,
  workspaceCwd,
}: {
  event: CursorEvent;
  workspaceCwd?: string;
}) {
  switch (event.type) {
    case "system": {
      return (
        <div className="py-2.5 mb-2 border-b border-border">
          <span className="text-xs font-mono text-dim">
            ┌ cursor-agent ·{" "}
            <span className="text-accent">{event.model}</span> · session started
          </span>
        </div>
      );
    }

    case "user": {
      const text = event.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      if (!text) return null;
      return (
        <div className="py-2">
          <span className="text-sm font-mono text-dim">{">"} {text}</span>
        </div>
      );
    }

    case "assistant": {
      const text = event.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      if (!text) return null;
      return (
        <div className="py-2.5 text-sm text-text leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      );
    }

    case "tool_call": {
      if (event.subtype === "started") {
        return <ToolCallStarted event={event} workspaceCwd={workspaceCwd} />;
      }
      return <ToolCallCompleted event={event} />;
    }

    case "result": {
      const isError = event.is_error;
      const seconds = (event.duration_ms / 1000).toFixed(1);
      const borderColor = isError ? "border-red-400/20" : "border-emerald-400/20";
      const bgColor = isError ? "bg-red-500/5" : "bg-emerald-500/5";
      const textColor = isError ? "text-red-400" : "text-emerald-400";
      const pillBg = isError ? "bg-red-500/10" : "bg-emerald-500/10";
      return (
        <div className={`mt-4 rounded-xl border ${borderColor} ${bgColor} p-4`}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className={`text-sm font-medium ${textColor}`}>
              {isError ? "✗ Failed" : "✓ Complete"}
            </span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${pillBg} ${textColor}`}>
              {seconds}s
            </span>
          </div>
          <div className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
            {event.result}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
