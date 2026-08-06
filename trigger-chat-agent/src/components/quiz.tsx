"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { reducedVariants, revealBlur } from "@/lib/motion";

/**
 * Quiz — a single multiple-choice retrieval-practice question with immediate
 * feedback. Pure data in (question, options, explanation); the interactivity is
 * the component's, so the model spends a handful of tokens, not a page of HTML.
 */
export function Quiz({
  question,
  options,
  explanation,
}: {
  question: string;
  options: { text: string; correct?: boolean | null }[];
  explanation?: string | null;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <motion.div
      variants={reduce ? reducedVariants : revealBlur}
      initial="hidden"
      animate="show"
      className="rounded-[20px] border border-grid-dimmed bg-charcoal-850 p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
    >
      <div className="mb-1 font-mono text-2xs uppercase tracking-widest text-dimmed/70">Quiz</div>
      <p className="mb-4 font-title text-lg font-medium text-bright">{question}</p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const isCorrect = Boolean(o.correct);
          const reveal = answered && (i === picked || isCorrect);
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                !reveal && "border-charcoal-700 bg-charcoal-800 text-bright enabled:hover:bg-charcoal-700",
                reveal && isCorrect && "border-apple-500/60 bg-apple-500/10 text-apple-200",
                reveal && !isCorrect && "border-error/60 bg-error/10 text-error"
              )}
            >
              {reveal && isCorrect && <CheckCircle2 className="size-4 shrink-0 text-apple-500" />}
              {reveal && !isCorrect && <XCircle className="size-4 shrink-0 text-error" />}
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {answered && explanation && (
        <p className="mt-4 border-t border-grid-bright pt-3 text-sm leading-relaxed text-dimmed">{explanation}</p>
      )}
    </motion.div>
  );
}
