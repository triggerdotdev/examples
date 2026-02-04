"use client";

import { ControlBar, useRunState } from "@/components/control-bar";
import { Terminal } from "@/components/terminal";

export default function Home() {
  const { runState, startRun, reset, markComplete } = useRunState();

  const showTerminal = runState.status === "running" || runState.status === "complete";

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold font-[family-name:var(--font-geist-mono)]">
          Cursor Agent Runner
        </h1>
        <p className="text-xs text-white/30 mt-1">
          Powered by Trigger.dev — watch an AI agent generate code in real time
        </p>
      </div>

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
    </main>
  );
}
