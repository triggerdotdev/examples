"use client";

import { motion, useReducedMotion } from "motion/react";
import { Highlight, themes } from "prism-react-renderer";
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
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <motion.div variants={item} className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/90" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/90" />
          <span className="h-3 w-3 rounded-full bg-green-500/90" />
        </div>
        {title && <span className="ml-2 font-mono text-xs text-muted-foreground">{title}</span>}
      </motion.div>
      <motion.div variants={item}>
        <Highlight code={code.trimEnd()} language={language ?? "typescript"} theme={themes.vsDark}>
          {({ className, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} max-h-[28rem] overflow-auto bg-transparent px-4 py-4 text-xs leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary`}
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
