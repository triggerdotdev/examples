"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { easings, reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";
import { CodeAwareLabel } from "@/components/code-aware-label";

/**
 * StatCard — a single KPI: label, headline value, optional delta badge and mini
 * bar chart. Ported from the Launch Week stat card: the value counts up and the
 * bars grow once the card scrolls into view; both collapse to their final state
 * under prefers-reduced-motion.
 */

const BAR_ROW_HEIGHT_PX = 128;

export function StatCard({
  label,
  value,
  deltaLabel,
  deltaPositive,
  bars,
}: {
  label: string;
  value: string;
  deltaLabel?: string | null;
  deltaPositive?: boolean | null;
  bars?: number[] | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const item = reduce ? reducedVariants : revealBlur;
  const container = reduce ? staggerContainer(0, 0) : staggerContainer(0.05);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      variants={container}
      className="flex min-h-64 flex-col justify-between rounded-2xl border border-grid-dimmed bg-charcoal-850 p-6"
    >
      <motion.div variants={item} className="flex items-center justify-between pb-4">
        <CodeAwareLabel
          value={label}
          className="font-mono text-2xs font-medium tracking-widest text-dimmed"
        />
        {deltaLabel && (
          <span
            className={cn(
              "rounded px-2 py-1 font-mono text-xs",
              deltaPositive === false ? "bg-error/10 text-error" : "bg-apple-500/10 text-apple-500"
            )}
          >
            {deltaLabel}
          </span>
        )}
      </motion.div>

      <motion.div variants={item} className="font-title text-3xl font-semibold tracking-tight text-bright">
        <AnimatedValue value={value} active={isInView} reduceMotion={!!reduce} />
      </motion.div>

      {bars && bars.length > 0 && (
        <motion.div variants={item}>
          <BarChart bars={bars} active={isInView} reduceMotion={!!reduce} />
        </motion.div>
      )}
    </motion.div>
  );
}

/** Counts a pre-formatted value ("1.4M", "99.2%") up from its zeroed form,
 * leaving any prefix/suffix in place. */
function AnimatedValue({ value, active, reduceMotion }: { value: string; active: boolean; reduceMotion: boolean }) {
  const match = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!match || !active || reduceMotion) {
      setDisplay(value);
      return;
    }
    const [, prefix, numText, suffix] = match;
    const target = Number(numText.replace(/,/g, ""));
    const decimals = numText.includes(".") ? numText.split(".")[1].length : 0;
    // Keep the authored digit grouping: "1,234" must animate to "1,234", not
    // "1234". toFixed drops separators, so re-group when the source had them.
    const grouped = numText.includes(",");
    const format = (v: number) =>
      grouped
        ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
    const controls = animate(0, target, {
      duration: 1,
      delay: 0.25,
      ease: easings.outExpo,
      onUpdate: (v) => setDisplay(`${prefix}${format(v)}${suffix}`),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion, value]);

  return <>{display}</>;
}

function BarChart({ bars, active, reduceMotion }: { bars: number[]; active: boolean; reduceMotion: boolean }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="mt-6">
      <div className="flex h-32 items-end gap-2">
        {bars.map((height, i) => {
          const isLast = i === bars.length - 1;
          const pct = Math.max(6, Math.round((height / max) * 100));
          const targetHeight = (pct / 100) * BAR_ROW_HEIGHT_PX;
          return (
            <motion.div
              key={i}
              className={cn("w-full flex-1 rounded-t-sm", isLast ? "bg-apple-500" : "bg-grid-bright")}
              initial={{ height: 0 }}
              animate={{ height: active || reduceMotion ? targetHeight : 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.15 + i * 0.05, ease: easings.outExpo }}
            />
          );
        })}
      </div>
    </div>
  );
}
