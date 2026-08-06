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

/**
 * Speech-bubble entrance — the "a message just arrived" pop shared by every
 * text bubble. The bubble grows from its tail corner (pair with
 * `origin-bottom-left` / `origin-bottom-right`) with a short fade + rise, so a
 * turn lands like an iMessage bubble rather than blinking in. Quick (≤~250ms)
 * and critically damped (no bounce). Rich cards use `revealBlur` instead:
 * bubbles grow, cards resolve.
 */
export const bubbleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 6 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      opacity: { duration: durations.fast, ease: easings.outExpo },
      scale: { duration: 0.25, ease: easings.outExpo },
      y: { duration: 0.25, ease: easings.outExpo },
    },
  },
};
