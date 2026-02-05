"use client";

import { ControlBar, useRunState } from "@/components/control-bar";
import { Terminal } from "@/components/terminal";

export function AgentRunner() {
  const { runState, startRun, reset, markComplete } = useRunState();

  const showTerminal = runState.status === "running" || runState.status === "complete";

  return (
    <>
      <ControlBar runState={runState} onRun={startRun} onReset={reset} />

      {showTerminal && (
        <Terminal
          runId={runState.runId}
          publicAccessToken={runState.publicAccessToken}
          onComplete={markComplete}
        />
      )}

      {runState.status === "failed" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-400 font-mono">
          {runState.error}
        </div>
      )}
    </>
  );
}
