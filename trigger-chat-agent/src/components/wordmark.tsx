import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The `chat.agent` wordmark — GeistMono with a green-phosphor glow and the dot
 * lit in apple. Ported from the Trigger.dev Launch Week chat lockup.
 */
export function AgentWordmark({ text = "chat.agent", className }: { text?: string; className?: string }) {
  const dot = text.indexOf(".");
  const inner: ReactNode =
    dot === -1 ? (
      text
    ) : (
      <>
        {text.slice(0, dot)}
        <span className="text-apple-500 [text-shadow:0_0_14px_rgba(168,255,83,0.65)]">.</span>
        {text.slice(dot + 1)}
      </>
    );

  return (
    <span
      className={cn("select-none font-mono font-medium leading-none tracking-[-0.02em] text-bright", className)}
      style={{ textShadow: "0 0 18px rgba(64,204,127,0.28), 0 0 2px rgba(255,255,255,0.35)" }}
    >
      {inner}
    </span>
  );
}
