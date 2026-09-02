"use client";

import { Code2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Highlight } from "prism-react-renderer";
import { triggerCodeTheme } from "@/lib/code-theme";
import { reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";

/**
 * CodeCard — a restrained code panel with syntax highlighting via
 * `prism-react-renderer` (self-contained, no
 * server). Entrance matches the other catalog cards (rise + fade + de-blur,
 * static under `prefers-reduced-motion`).
 */
export function CodeCard({
  title,
  language,
  code,
}: {
  title?: string | null;
  language?: string | null;
  code: string;
}) {
  const reduceMotion = useReducedMotion();
  const item = reduceMotion ? reducedVariants : revealBlur;
  const container = reduceMotion ? staggerContainer(0, 0) : staggerContainer(0.05);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="overflow-hidden rounded-2xl border border-grid-dimmed bg-charcoal-850"
    >
      <motion.div variants={item} className="flex min-h-12 items-center gap-2 border-b border-grid-bright bg-charcoal-800 px-5 py-3">
        <Code2 className="size-4 text-apple-500" />
        <span className="font-mono text-xs text-dimmed">{title ?? language ?? "Code"}</span>
      </motion.div>
      <motion.div variants={item}>
        <Highlight code={code.trimEnd()} language={language ?? "typescript"} theme={triggerCodeTheme}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} max-h-[28rem] overflow-auto p-5 font-mono text-xs leading-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700`}
              style={style}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </motion.div>
    </motion.div>
  );
}
