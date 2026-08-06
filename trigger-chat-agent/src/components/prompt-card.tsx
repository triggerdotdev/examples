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
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <motion.div variants={item} className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <span className="font-sans text-sm font-medium text-foreground">{title}</span>
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors",
            copied
              ? "bg-primary/15 text-primary"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </motion.div>

      <motion.pre
        variants={item}
        className="max-h-[24rem] overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-sm leading-relaxed text-foreground/90 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary"
      >
        {prompt}
      </motion.pre>

      <motion.p variants={item} className="border-t px-5 py-3 font-sans text-xs text-muted-foreground">
        {caption ?? DEFAULT_CAPTION}
      </motion.p>
    </motion.div>
  );
}
