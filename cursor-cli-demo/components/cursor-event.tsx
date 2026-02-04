"use client";

import type { CursorEvent, ToolCallEvent } from "@/lib/cursor-events";
import { getToolName, getToolArgs } from "@/lib/cursor-events";

function ToolCallStarted({ event }: { event: ToolCallEvent }) {
  const toolName = getToolName(event);
  const args = getToolArgs(event);

  switch (toolName) {
    case "writeToolCall":
    case "editToolCall":
    case "deleteToolCall": {
      const filePath = (args.filePath as string) ?? (args.path as string) ?? "unknown";
      const action = toolName === "writeToolCall" ? "create" : toolName === "editToolCall" ? "edit" : "delete";
      const color = toolName === "deleteToolCall" ? "text-red-400" : "text-green-400";
      return (
        <div className="flex items-center gap-2 py-1">
          <span className={`text-xs px-2 py-0.5 rounded bg-white/5 ${color} font-mono`}>
            {action}
          </span>
          <span className="text-sm font-mono text-white/80">{filePath}</span>
        </div>
      );
    }
    case "shellToolCall": {
      const command = (args.command as string) ?? (args.cmd as string) ?? "";
      return (
        <div className="py-1">
          <span className="text-sm font-mono text-white/40">$ {command}</span>
        </div>
      );
    }
    case "readToolCall":
    case "grepToolCall":
    case "lsToolCall":
    case "globToolCall": {
      const target = (args.filePath as string) ?? (args.path as string) ?? (args.pattern as string) ?? "";
      return (
        <div className="py-0.5">
          <span className="text-xs font-mono text-white/30">{toolName.replace("ToolCall", "")} {target}</span>
        </div>
      );
    }
    default:
      return (
        <div className="py-0.5">
          <span className="text-xs font-mono text-white/30">{toolName}</span>
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
      <div className="py-0.5">
        <span className="text-xs font-mono text-red-400/60">✗ {toolName.replace("ToolCall", "")} failed</span>
      </div>
    );
  }

  // Successful completions are silent (the started event already showed the action)
  return null;
}

export function CursorEventRow({ event }: { event: CursorEvent }) {
  switch (event.type) {
    case "system": {
      return (
        <div className="py-2 text-xs font-mono text-white/30 border-b border-white/5">
          cursor-agent · {event.model} · {event.cwd}
        </div>
      );
    }

    case "user":
      // User already sees their prompt in the control bar
      return null;

    case "assistant": {
      const text = event.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      if (!text) return null;
      return (
        <div className="py-2 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      );
    }

    case "tool_call": {
      if (event.subtype === "started") {
        return <ToolCallStarted event={event} />;
      }
      return <ToolCallCompleted event={event} />;
    }

    case "result": {
      return (
        <div className="py-3 mt-2 border-t border-white/10">
          <div className="text-sm text-white/90 whitespace-pre-wrap">{event.result}</div>
          <div className="text-xs text-white/30 mt-1">
            Completed in {(event.duration_ms / 1000).toFixed(1)}s
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
