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
  const [prompt, setPrompt] = useState(
    "Create a TypeScript CLI tool that converts celsius to fahrenheit with input validation"
  );
  const [model, setModel] = useState("sonnet-4.5");

  const isDisabled = runState.status === "starting" || runState.status === "running";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prompt.trim() || isDisabled) return;
    onRun(prompt.trim(), model);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!prompt.trim() || isDisabled) return;
      onRun(prompt.trim(), model);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="bg-white/[0.018] backdrop-blur-[16px] rounded-2xl border border-border p-1.5 transition-colors focus-within:border-border-strong">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="Describe what to build..."
            rows={2}
            className="w-full bg-transparent resize-none px-4 py-3.5 text-sm text-text placeholder:text-dim focus:outline-none disabled:opacity-40 font-mono leading-relaxed"
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-1.5">
              {models.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setModel(m.value)}
                  className={`border transition-all duration-150 ease cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-medium ${
                    model === m.value
                      ? "bg-accent-soft border-[rgba(45,212,191,0.15)] text-accent"
                      : "border-border text-muted hover:not-disabled:border-border-strong hover:not-disabled:bg-white/[0.025]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {runState.status === "complete" || runState.status === "failed" ? (
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-2 rounded-lg border border-border text-muted text-xs font-medium hover:border-border-strong hover:text-text transition-all"
              >
                New run
              </button>
            ) : (
              <button
                type="submit"
                disabled={isDisabled || !prompt.trim()}
                className="bg-linear-to-br from-accent to-[#25B5A3] text-surface font-semibold transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:not-disabled:shadow-[0_0_24px_rgba(45,212,191,0.3),0_2px_8px_rgba(0,0,0,0.3)] hover:not-disabled:-translate-y-px active:not-disabled:translate-y-0 disabled:opacity-25 disabled:cursor-not-allowed px-5 py-2 rounded-lg text-sm"
              >
                {runState.status === "starting" ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Starting...
                  </span>
                ) : (
                  "Run"
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {runState.status === "starting" && (
        <div className="mt-3 flex items-center gap-2 px-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-dim">Triggering task...</span>
        </div>
      )}

      {runState.status === "failed" && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span className="text-xs text-red-400 font-mono">{runState.error}</span>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
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
