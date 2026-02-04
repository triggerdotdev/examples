"use client";

import { useState } from "react";

const models = [
  { value: "sonnet-4.5", label: "Sonnet 4.5" },
  { value: "opus-4.5", label: "Opus 4.5" },
  { value: "gemini-3-pro", label: "Gemini 3 Pro" },
];

type RunState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running"; runId: string; publicAccessToken: string }
  | { status: "complete"; runId: string; publicAccessToken: string }
  | { status: "failed"; error: string };

export function useRunState() {
  const [runState, setRunState] = useState<RunState>({ status: "idle" });

  async function startRun(prompt: string, model: string) {
    setRunState({ status: "starting" });

    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      });

      if (!res.ok) {
        const data = await res.json();
        setRunState({ status: "failed", error: data.error ?? "Request failed" });
        return;
      }

      const { runId, publicAccessToken } = await res.json();
      setRunState({ status: "running", runId, publicAccessToken });
    } catch (err) {
      setRunState({ status: "failed", error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  function reset() {
    setRunState({ status: "idle" });
  }

  function markComplete() {
    setRunState((prev) => {
      if (prev.status === "running") {
        return { status: "complete", runId: prev.runId, publicAccessToken: prev.publicAccessToken };
      }
      return prev;
    });
  }

  return { runState, startRun, reset, markComplete };
}

export function ControlBar({
  runState,
  onRun,
  onReset,
}: {
  runState: RunState;
  onRun: (prompt: string, model: string) => void;
  onReset: () => void;
}) {
  const [prompt, setPrompt] = useState("Create a TypeScript CLI tool that converts celsius to fahrenheit with input validation");
  const [model, setModel] = useState("sonnet-4.5");

  const isDisabled = runState.status === "starting" || runState.status === "running";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prompt.trim() || isDisabled) return;
    onRun(prompt.trim(), model);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isDisabled}
          placeholder="Describe what to create..."
          className="flex-1 bg-[var(--terminal-bg)] border border-[var(--terminal-border)] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 disabled:opacity-50 font-[family-name:var(--font-geist-mono)]"
        />

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={isDisabled}
          className="bg-[var(--terminal-bg)] border border-[var(--terminal-border)] rounded-lg px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-white/30 disabled:opacity-50"
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {runState.status === "complete" || runState.status === "failed" ? (
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
          >
            New run
          </button>
        ) : (
          <button
            type="submit"
            disabled={isDisabled || !prompt.trim()}
            className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {runState.status === "starting" ? "Starting..." : "Run"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StatusDot status={runState.status} />
        <span className="text-xs text-white/40">
          {runState.status === "idle" && "Ready"}
          {runState.status === "starting" && "Triggering task..."}
          {runState.status === "running" && "Agent is working..."}
          {runState.status === "complete" && "Complete"}
          {runState.status === "failed" && `Failed: ${runState.error}`}
        </span>
      </div>
    </form>
  );
}

function StatusDot({ status }: { status: RunState["status"] }) {
  const color =
    status === "running" || status === "starting"
      ? "bg-yellow-400 animate-pulse"
      : status === "complete"
        ? "bg-green-400"
        : status === "failed"
          ? "bg-red-400"
          : "bg-white/20";

  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}
