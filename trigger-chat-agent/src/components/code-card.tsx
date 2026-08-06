"use client";

import { motion, useReducedMotion } from "motion/react";
import { Highlight } from "prism-react-renderer";
import { triggerCodeTheme } from "@/lib/code-theme";
import { reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";

/**
 * CodeCard — a code snippet in a terminal-style window with macOS traffic-light
 * dots. Syntax highlighting via `prism-react-renderer` (self-contained, no
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
      className="overflow-hidden rounded-[20px] border border-grid-dimmed bg-charcoal-850 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
    >
      <motion.div variants={item} className="flex items-center gap-2 border-b border-grid-bright bg-charcoal-800 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          <span className="h-3 w-3 rounded-full bg-yellow-500" />
          <span className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        {title && <span className="ml-2 font-mono text-xs text-dimmed">{title}</span>}
      </motion.div>
      <motion.div variants={item}>
        <Highlight code={code.trimEnd()} language={language ?? "typescript"} theme={triggerCodeTheme}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} max-h-[28rem] overflow-auto px-4 py-4 font-mono text-xs leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-charcoal-700`}
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
