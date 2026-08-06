"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { easings, reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";

/**
 * DiagramCard — a horizontal step-flow with colored status dots and dashed
 * connectors (e.g. Triggered -> Attempt 1 -> Fails -> Backoff -> Attempt 2 ->
 * Success).
 *
 * Steps light up in sequence as the flow "runs" (each pops in already in its
 * status color, with an error step getting a red pulse-ring), dashed connectors
 * draw left-to-right between them, and the fail -> backoff -> success beat gets
 * an extra pause on the failure so the retry reads with real timing. Plays once
 * when scrolled into view; collapses to an instant layout under
 * `prefers-reduced-motion`. The track scrolls inside the card on overflow, with
 * a right-edge fade cueing there's more. For architecture / branching / fan-out,
 * prefer FlowGraph.
 */

type StepStatus = "default" | "error" | "warning" | "success";

const statusClasses: Record<StepStatus, { border: string; dot: string; text: string }> = {
  default: { border: "border-grid-bright", dot: "bg-dimmed", text: "text-bright" },
  error: { border: "border-error/30", dot: "bg-error", text: "text-error" },
  warning: { border: "border-warning/30", dot: "bg-warning", text: "text-warning" },
  success: { border: "border-success/30", dot: "bg-success", text: "text-success" },
};

/**
 * Cumulative reveal delay (seconds) per step, in flow order. Adds a beat of
 * pause after an `error` step so recovery (backoff -> retry -> success) plays
 * with a real pause on the failure instead of an even metronome.
 */
function computeStepDelays(steps: { status?: StepStatus | null }[]): number[] {
  const delays: number[] = [];
  let t = 0.1;
  steps.forEach((step, i) => {
    if (i > 0) t += 0.4;
    delays.push(t);
    if (step.status === "error") t += 0.5;
  });
  return delays;
}

export function DiagramCard({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; status?: StepStatus | null }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const reduceMotion = useReducedMotion();

  const item = reduceMotion ? reducedVariants : revealBlur;
  const container = reduceMotion ? staggerContainer(0, 0) : staggerContainer(0.05);
  const delays = computeStepDelays(steps);
  const playDiagram = !!reduceMotion || isInView;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      variants={container}
      className="flex flex-col overflow-hidden rounded-[20px] border border-grid-dimmed bg-charcoal-850 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
    >
      <motion.div variants={item} className="flex items-center gap-2 border-b border-grid-bright bg-charcoal-800 px-4 py-3">
        <span className="font-title text-sm font-medium text-bright/80">{title}</span>
      </motion.div>

      <motion.div variants={item} className="relative">
        <div className="overflow-x-auto px-6 py-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary">
          <div className="flex items-center">
            {steps.map((step, i) => {
              const status = statusClasses[step.status ?? "default"];
              return (
                <div key={i} className="flex items-center">
                  {i > 0 && (
                    <Connector delay={delays[i - 1] + 0.15} active={playDiagram} reduceMotion={!!reduceMotion} />
                  )}
                  <motion.div
                    // Rise + fade + settle — no overshoot (scale climbs 0.9 -> 1 and stops there).
                    initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
                    animate={playDiagram ? { opacity: 1, y: 0, scale: 1 } : {}}
                    transition={
                      reduceMotion ? { duration: 0 } : { delay: delays[i], duration: 0.35, ease: easings.outExpo }
                    }
                    className={cn(
                      "relative flex items-center gap-2 whitespace-nowrap rounded-full border bg-charcoal-800 px-4 py-2.5 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]",
                      status.border
                    )}
                  >
                    {step.status === "error" && !reduceMotion && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-error/40"
                        initial={{ opacity: 0.6, scale: 1 }}
                        animate={playDiagram ? { opacity: 0, scale: 1.5 } : {}}
                        transition={{ delay: delays[i], duration: 0.7, ease: easings.outExpo }}
                      />
                    )}
                    <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                    <span className={cn("font-sans text-sm font-medium", status.text)}>{step.label}</span>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
        {/* right-edge fade — cues horizontal scroll when the flow overflows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-charcoal-850 to-transparent"
        />
      </motion.div>
    </motion.div>
  );
}

function Connector({ delay, active, reduceMotion }: { delay: number; active: boolean; reduceMotion: boolean }) {
  return (
    <motion.div
      style={{ originX: 0 }}
      initial={reduceMotion ? false : { scaleX: 0, opacity: 0.4 }}
      animate={active ? { scaleX: 1, opacity: 1 } : {}}
      transition={reduceMotion ? { duration: 0 } : { delay, duration: 0.3, ease: easings.outExpo }}
      className="mx-1 h-0.5 w-6 shrink-0 border-t-2 border-dashed border-grid-bright sm:w-8"
    />
  );
}
