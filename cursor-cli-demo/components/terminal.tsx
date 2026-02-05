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

  // Notify parent when run finishes
  const notified = useRef(false);
  useEffect(() => {
    if ((isComplete || isFailed) && !notified.current) {
      notified.current = true;
      onComplete?.();
    }
  }, [isComplete, isFailed, onComplete]);

  // Auto-scroll when new events arrive (unless user scrolled up)
  useEffect(() => {
    if (events.length > 0 && !userScrolledUp.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [events.length]);

  if (error) {
    return (
      <div className="bg-[var(--terminal-bg)] border border-red-500/20 rounded-lg p-4 font-mono text-sm text-red-400">
        Connection error: {error.message}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="bg-[var(--terminal-bg)] border border-[var(--terminal-border)] rounded-lg p-4 font-[family-name:var(--font-geist-mono)] text-sm overflow-y-auto max-h-[600px] min-h-[300px]"
    >
      {isQueued && (
        <div className="flex items-center gap-2 text-white/30 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Queued — waiting for worker...
        </div>
      )}

      {events.length === 0 && isRunning && (
        <div className="flex items-center gap-2 text-white/30 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Starting cursor-agent...
        </div>
      )}

      {events.map((event, i) => (
        <CursorEventRow key={i} event={event} />
      ))}

      {isRunning && (
        <span className="inline-block w-2 h-4 bg-white/60 animate-pulse ml-0.5" />
      )}

      {isFailed && (
        <div className="text-red-400 text-sm">
          {getRunErrorMessage(run?.output)}
        </div>
      )}

      {isComplete && events.length === 0 && (
        <div className="text-white/40 text-xs">Task completed with no output</div>
      )}
    </div>
  );
}
