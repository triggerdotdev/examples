"use client";

import { useRef, useCallback, useEffect, useMemo } from "react";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import type { cursorAgentTask, STREAMS } from "@/trigger/cursor-agent";
import { parseCursorEvent } from "@/lib/cursor-events";
import { CursorEventRow } from "./cursor-event";

function getRunErrorMessage(output: unknown): string {
  if (typeof output !== "object" || output === null) return "Task failed";
  if ("message" in output && typeof output.message === "string") return output.message;
  if ("error" in output && typeof output.error === "string") return output.error;
  return "Task failed";
}

export function Terminal({
  runId,
  publicAccessToken,
  onComplete,
}: {
  runId: string;
  publicAccessToken: string;
  onComplete?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  const { run, streams, error } = useRealtimeRunWithStreams<typeof cursorAgentTask, STREAMS>(
    runId,
    { accessToken: publicAccessToken }
  );

  const rawEvents = streams?.["cursor-events"] ?? [];
  const events = useMemo(
    () => rawEvents.map(parseCursorEvent).filter((e) => e !== null),
    [rawEvents]
  );

  const workspaceCwd = useMemo(() => {
    const systemEvent = events.find((e) => e.type === "system");
    return systemEvent?.type === "system" ? systemEvent.cwd : undefined;
  }, [events]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUp.current = !atBottom;
  }, []);

  const status = run?.status;
  const isRunning = status === "EXECUTING";
  const isQueued = status === "PENDING_VERSION" || status === "DELAYED" || !status;
  const isFailed = status === "FAILED" || status === "CRASHED" || status === "SYSTEM_FAILURE";
  const isComplete = status === "COMPLETED";

  const notified = useRef(false);
  useEffect(() => {
    if ((isComplete || isFailed) && !notified.current) {
      notified.current = true;
      onComplete?.();
    }
  }, [isComplete, isFailed, onComplete]);

  useEffect(() => {
    if (events.length > 0 && !userScrolledUp.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [events.length]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 font-mono text-sm text-red-400">
        Connection error: {error.message}
      </div>
    );
  }

  const statusLabel = isQueued
    ? "Queued"
    : isRunning
      ? "Running"
      : isComplete
        ? "Complete"
        : isFailed
          ? "Failed"
          : "";

  const statusDotClass = isQueued
    ? "bg-warning"
    : isRunning
      ? "bg-accent"
      : isComplete
        ? "bg-success"
        : isFailed
          ? "bg-error"
          : "bg-dim";

  const statusTextClass = isQueued
    ? "text-warning"
    : isRunning
      ? "text-accent"
      : isComplete
        ? "text-success"
        : isFailed
          ? "text-error"
          : "text-dim";

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors duration-500 bg-terminal-bg ${
        isRunning ? "animate-pulse-glow" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white/[0.012]">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-accent">◆</span>
          <span className="text-xs font-mono text-muted">cursor-agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusDotClass} ${isRunning || isQueued ? "animate-pulse" : ""}`}
          />
          <span className={`text-[11px] font-mono ${statusTextClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="p-5 font-mono text-sm overflow-y-auto max-h-[600px] min-h-[200px]"
      >
        {isQueued && (
          <div className="flex items-center gap-2.5 text-dim text-xs">
            <LoadingSpinner />
            Waiting for worker...
          </div>
        )}

        {events.length === 0 && isRunning && (
          <div className="flex items-center gap-2.5 text-dim text-xs">
            <LoadingSpinner />
            Initializing cursor-agent...
          </div>
        )}

        {events.map((event, i) => (
          <CursorEventRow key={i} event={event} workspaceCwd={workspaceCwd} />
        ))}

        {isRunning && <span className="inline-block w-[7px] h-[15px] bg-accent animate-cursor-blink ml-0.5 align-text-bottom rounded-[1px]" />}

        {isFailed && (
          <div className="mt-2 text-red-400 text-sm">{getRunErrorMessage(run?.output)}</div>
        )}

        {isComplete && events.length === 0 && (
          <div className="text-dim text-xs">Completed with no output</div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-3 w-3 text-dim" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-80"
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
