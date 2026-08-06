import type { Variants } from "motion/react";

/**
 * Shared motion kit for the generative-UI catalog cards (FlowGraph, CodeCard,
 * DiagramCard, PromptCard). A trimmed port of the Trigger.dev marketing site's
 * animation tokens: asymmetric ease-out curves (quick accel, long damped
 * settle) and motion reserved for state signals — cards "resolving" as the
 * agent composes an answer — never idle decoration.
 */

// Cubic-bezier control points. Typed as a mutable 4-tuple so `motion`'s `ease`
// prop accepts it directly.
type Bezier = [number, number, number, number];

export const easings = {
  /** Default entrance curve — sharp accel, long settle. */
  outExpo: [0.16, 1, 0.3, 1] as Bezier,
  /** Exits only — quick start, fast finish. */
  inQuart: [0.5, 0, 0.75, 0] as Bezier,
} as const;

export const durations = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3,
} as const;

/** `prefers-reduced-motion` fallback: instant, opacity-only. */
export const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

/**
 * Rise + fade + de-blur — the signature entrance for generative-UI cards.
 * Opacity arrives first, then y and blur settle together, so a card reads as
 * "fading into solidity" as the agent's answer streams in.
 */
export const revealBlur: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      opacity: { duration: durations.base, ease: easings.outExpo },
      y: { duration: durations.slow, ease: easings.outExpo },
      filter: { duration: durations.slow, ease: easings.outExpo },
    },
  },
};

/** Staggers `revealBlur` children by mount order. Keep groups small. */
export function staggerContainer(staggerChildren = 0.05, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}
