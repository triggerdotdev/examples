"use client";

import { AlertTriangle, Info, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeAwareLabel } from "@/components/code-aware-label";

/**
 * Small data-driven teaching components — Callout, Steps, Glossary, Compare.
 * All pure data-fill (no HTML, no interactivity beyond hover), so they're cheap
 * for the model and consistent on screen.
 */

const CALLOUT: Record<string, { border: string; bg: string; icon: LucideIcon; color: string }> = {
  tip: { border: "border-apple-500/40", bg: "bg-apple-500/5", icon: Lightbulb, color: "text-apple-500" },
  warn: { border: "border-warning/40", bg: "bg-warning/5", icon: AlertTriangle, color: "text-warning" },
  note: { border: "border-grid-bright", bg: "bg-charcoal-850", icon: Info, color: "text-dimmed" },
};

export function Callout({
  variant,
  title,
  text,
}: {
  variant?: "tip" | "warn" | "note" | null;
  title?: string | null;
  text: string;
}) {
  const s = CALLOUT[variant ?? "note"] ?? CALLOUT.note;
  const Icon = s.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 sm:p-5", s.border, s.bg)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", s.color)} />
      <div>
        {title && <div className="mb-1 font-title text-sm font-medium text-bright">{title}</div>}
        <p className="text-sm leading-6 text-dimmed [text-wrap:pretty]">{text}</p>
      </div>
    </div>
  );
}

export function Steps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <div className="rounded-2xl border border-grid-dimmed bg-charcoal-850 p-5 sm:p-6">
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-grid-bright font-mono text-xs text-apple-500">
              {i + 1}
            </span>
            <div>
              <div className="font-title text-sm font-medium text-bright">{s.title}</div>
              <p className="mt-1 text-sm leading-6 text-dimmed [text-wrap:pretty]">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Glossary({ terms }: { terms: { term: string; definition: string }[] }) {
  return (
    <div className="rounded-2xl border border-grid-dimmed bg-charcoal-850 p-5 sm:p-6">
      <dl className="space-y-3">
        {terms.map((t, i) => (
          <div key={i} className="border-b border-grid-bright pb-3 last:border-0 last:pb-0">
            <dt className="font-mono text-sm text-apple-500">{t.term}</dt>
            <dd className="mt-1 text-sm leading-6 text-dimmed [text-wrap:pretty]">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Compare({
  title,
  a,
  b,
}: {
  title?: string | null;
  a: { label: string; points: string[] };
  b: { label: string; points: string[] };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-grid-dimmed bg-charcoal-850">
      {title && (
        <div className="border-b border-grid-bright px-5 py-3 font-title text-sm font-medium text-bright/80">{title}</div>
      )}
      <div className="grid grid-cols-1 divide-y divide-grid-bright sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {[a, b].map((col, ci) => (
          <div key={ci} className="p-5">
            <div className="mb-3">
              <CodeAwareLabel
                value={col.label}
                className="font-mono text-xs tracking-wider text-apple-500"
              />
            </div>
            <ul className="space-y-2">
              {col.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm leading-6 text-dimmed">
                  <span className="text-apple-500">·</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
