"use client";

import { AlertTriangle, RotateCw, X } from "lucide-react";

/**
 * Inline error state. A banner in the thread rather than a toast: an error
 * here is usually a setup problem (dev server not running, missing key), and
 * those deserve to stay on screen with a retry rather than vanish after 4s.
 */

/**
 * Turn a failure into something actionable. The common one when running this
 * example is simply that `pnpm dev:trigger` isn't running, which surfaces as a
 * network/fetch failure when the session can't be started.
 */
function explain(error: Error): { title: string; detail: string } {
  const message = error.message || String(error);

  if (/fetch failed|network|econnrefused|failed to fetch|load failed/i.test(message)) {
    return {
      title: "Can't reach the agent",
      detail:
        "The chat agent isn't responding. Check that `pnpm dev:trigger` is running in another terminal, and that TRIGGER_SECRET_KEY and TRIGGER_PROJECT_REF are set in .env.",
    };
  }
  if (/no.?tasks?|task.*not found|deployment|no worker/i.test(message)) {
    return {
      title: "Agent not found",
      detail:
        "Trigger.dev couldn't find the `trigger-chat-agent` task. Make sure `pnpm dev:trigger` has started and registered it.",
    };
  }
  if (/unauthorized|401|403|invalid.*key|forbidden/i.test(message)) {
    return {
      title: "Not authorized",
      detail: "Trigger.dev rejected the credentials. Check TRIGGER_SECRET_KEY and TRIGGER_PROJECT_REF in .env.",
    };
  }
  return { title: "Something went wrong", detail: message };
}

export function ErrorNotice({
  error,
  onRetry,
  onDismiss,
}: {
  error: Error;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { title, detail } = explain(error);

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-error/40 bg-error/5 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-error">{title}</div>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-dimmed">{detail}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-charcoal-700 px-3 text-xs font-medium text-bright transition-colors duration-150 hover:bg-charcoal-800"
        >
          <RotateCw className="size-3" /> Try again
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-dimmed transition-colors duration-150 hover:bg-charcoal-800 hover:text-bright"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
