"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useContext, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { reducedVariants, revealBlur } from "@/lib/motion";
import { QuizGateContext } from "@/components/quiz-gate";

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
  const quizId = useId();
  const reportBlocking = useContext(QuizGateContext);

  useEffect(() => {
    reportBlocking(quizId, !answered);
    return () => reportBlocking(quizId, false);
  }, [answered, quizId, reportBlocking]);

  return (
    <motion.div
      variants={reduce ? reducedVariants : revealBlur}
      initial="hidden"
      animate="show"
      className="rounded-2xl border border-grid-dimmed bg-charcoal-850 p-5 sm:p-6"
    >
      <div className="mb-1 font-mono text-2xs uppercase tracking-widest text-apple-500">Quiz</div>
      <p className="mb-4 font-title text-lg font-medium text-bright">{question}</p>
      {/* aria-disabled (not the `disabled` attribute) keeps answered options in
          the tab order, so a keyboard user can still move across and read the
          revealed correct/incorrect states; a click guard blocks re-answering. */}
      <div className="space-y-2" role="group" aria-label={question}>
        {options.map((o, i) => {
          const isCorrect = Boolean(o.correct);
          const reveal = answered && (i === picked || isCorrect);
          return (
            <button
              key={i}
              type="button"
              aria-disabled={answered}
              onClick={() => {
                if (!answered) setPicked(i);
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm leading-5 transition-colors duration-150",
                !reveal && "border-charcoal-700 bg-charcoal-800 text-bright",
                !reveal && !answered && "cursor-pointer hover:bg-charcoal-700",
                answered && "cursor-default",
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
      {/* Live region present before the answer lands, so screen readers
          announce the explanation when it appears. */}
      <div aria-live="polite">
        {answered && explanation && (
          <p className="mt-4 border-t border-grid-bright pt-3 text-sm leading-relaxed text-dimmed">{explanation}</p>
        )}
      </div>
    </motion.div>
  );
}
