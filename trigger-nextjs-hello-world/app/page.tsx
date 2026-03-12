"use client";

import { useState } from "react";
import { TriggerLogo } from "./components/trigger-logo";

const featureCards = [
  {
    title: "Quick start",
    description: "Get started with Trigger.dev in minutes",
    href: "https://trigger.dev/docs/quick-start",
  },
  {
    title: "Building with AI",
    description: "Tools using Trigger.dev with AI assistants",
    href: "https://trigger.dev/docs/building-with-ai",
  },
  {
    title: "Realtime",
    description: "Trigger/subscribe to runs from your app",
    href: "https://trigger.dev/docs/realtime",
  },
  {
    title: "Scheduled Tasks",
    description: "Run tasks on a recurring schedule",
    href: "https://trigger.dev/docs/tasks/scheduled",
  },
];

export default function Home() {
  const [result, setResult] = useState<{
    id?: string;
    publicAccessToken?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTrigger() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center justify-center text-center space-y-4 ">
          <a
            href="https://trigger.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <TriggerLogo className="h-10 md:h-12 w-auto mx-auto" />
          </a>
          <p className="text-text-dimmed text-sm font-mono">
            Get started by editing{" "}
            <code className="text-text-bright bg-charcoal-750 px-1.5 py-0.5 rounded">
              trigger/hello-world.ts
            </code>
          </p>
        </div>

        <button
          onClick={handleTrigger}
          disabled={loading}
          className="px-6 py-3 rounded-lg bg-primary text-charcoal-900 font-semibold text-sm
            hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
        >
          {loading ? "Triggering..." : "Trigger a task"}
        </button>

        {/* Result card */}
        {result && (
          <div className="w-full max-w-md rounded-xl border border-grid-bright bg-card p-5 space-y-3">
            {result.error ? (
              <p className="text-red-400 text-sm font-mono">{result.error}</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium">Task triggered</span>
                </div>
                <p className="text-text-dimmed text-xs font-mono">
                  Run ID: {result.id}
                </p>
                <a
                  href={`https://cloud.trigger.dev/runs/${result.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  View in Trigger.dev Cloud
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </>
            )}
          </div>
        )}
      </main>

      {/* Feature cards */}
      <footer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-grid-dimmed border-t border-grid-dimmed">
        {featureCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-background p-6 hover:bg-charcoal-750 transition-colors"
          >
            <h2 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">
              {card.title}
              <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                &rarr;
              </span>
            </h2>
            <p className="text-text-dimmed text-xs leading-relaxed">
              {card.description}
            </p>
          </a>
        ))}
      </footer>
    </div>
  );
}
