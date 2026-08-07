"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";

/**
 * PromptCard — a paste-ready prompt in a mono block with a one-click "Copy
 * prompt" button. The growth exit: hand the user a prompt to paste into Claude
 * Code, Cursor, or any coding agent and build the thing being discussed in
 * their own repo. Distinct from CodeCard, which is read, not taken.
 */

const DEFAULT_CAPTION = "Paste into Claude Code, Cursor, or any coding agent.";

export function PromptCard({
  title,
  prompt,
  caption,
}: {
  title: string;
  prompt: string;
  caption?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const item = reduceMotion ? reducedVariants : revealBlur;
  const container = reduceMotion ? staggerContainer(0, 0) : staggerContainer(0.05);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context or denied permission) —
      // leave the button idle rather than showing a false "Copied".
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="overflow-hidden rounded-2xl border border-grid-dimmed bg-charcoal-850"
    >
      <motion.div variants={item} className="flex min-h-12 items-center justify-between gap-3 border-b border-grid-bright bg-charcoal-800 px-5 py-3">
        <span className="font-title text-sm font-medium text-bright/80">{title}</span>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "min-h-11 shrink-0 rounded-lg px-3 font-sans text-xs font-medium transition-colors duration-150",
            copied
              ? "bg-apple-500/15 text-apple-500"
              : "bg-apple-500 text-charcoal-900 hover:bg-apple-400"
          )}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </motion.div>

      <motion.pre
        variants={item}
        className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-sm leading-6 text-bright scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700"
      >
        {prompt}
      </motion.pre>

      <motion.p variants={item} className="border-t border-grid-bright px-5 py-3 font-sans text-xs text-dimmed">
        {caption ?? DEFAULT_CAPTION}
      </motion.p>
    </motion.div>
  );
}
