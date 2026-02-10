"use client";

import { ControlBar, useRunState } from "@/components/control-bar";
import { Terminal } from "@/components/terminal";

export function AgentRunner() {
  const { runState, startRun, reset, markComplete } = useRunState();

  return (
    <div className="flex flex-col gap-6">
      <ControlBar runState={runState} onRun={startRun} onReset={reset} />

      {(runState.status === "running" || runState.status === "complete") && (
        <div className="animate-fade-in">
          <Terminal
            runId={runState.runId}
            publicAccessToken={runState.publicAccessToken}
            onComplete={markComplete}
          />
        </div>
      )}
    </div>
  );
}
