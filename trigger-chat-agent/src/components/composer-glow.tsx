/**
 * Focus ring: on focus, a surface's border lights up as the full brand gradient
 * (blue → teal → apple); at rest it's the plain grey border. Fades via
 * `--lw3-glow-focus`, which the wrapper sets to 1 on focus-within.
 *
 * Pure CSS, no SVG: a masked 1px gradient RING (the gradient-border mask trick —
 * two identical fills composited with exclude/xor so only the padding ring
 * paints). Decorative (aria-hidden); the opacity fade is a state change, so it's
 * fine under reduced motion. Ported from the Trigger.dev Launch Week composer.
 */

// Blue → teal → apple, so the house green lands at the trailing edge.
const GRADIENT = "linear-gradient(120deg, #479DEC 0%, #2DD4BF 50%, #A8FF53 100%)";
const RING_MASK = "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)";

export function FocusGlow({ radiusClassName = "rounded-full" }: { radiusClassName?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-20 ${radiusClassName} p-px`}
      style={{
        background: GRADIENT,
        opacity: "var(--lw3-glow-focus, 0)",
        transition: "opacity 450ms ease-out",
        WebkitMask: RING_MASK,
        WebkitMaskComposite: "xor",
        mask: RING_MASK,
        maskComposite: "exclude",
      }}
    />
  );
}
