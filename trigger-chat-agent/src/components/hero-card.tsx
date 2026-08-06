"use client";

import {
  BarChart3,
  Bolt,
  Check,
  Clock,
  Cog,
  Command,
  Cpu,
  Database,
  Rocket,
  Server,
  Shield,
  Signal,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { reducedVariants, revealBlur, staggerContainer } from "@/lib/motion";

/**
 * HeroCard — the intro card that opens a topic: an optional icon badge, a mono
 * apple kicker, a display title, and a short blurb. Ported from the Launch Week
 * hero card (image/link layouts dropped). `featured` steps the type up for the
 * single lead card of an answer.
 */

const ICONS: Record<string, LucideIcon> = {
  bolt: Bolt,
  server: Server,
  cpu: Cpu,
  clock: Clock,
  rocket: Rocket,
  command: Command,
  cog: Cog,
  database: Database,
  chart: BarChart3,
  shield: Shield,
  signal: Signal,
  check: Check,
};

export function HeroCard({
  icon,
  kicker,
  title,
  description,
  featured,
}: {
  icon?: string | null;
  kicker?: string | null;
  title: string;
  description: string;
  featured?: boolean | null;
}) {
  const reduce = useReducedMotion();
  const item = reduce ? reducedVariants : revealBlur;
  const container = reduce ? staggerContainer(0, 0) : staggerContainer(0.05);
  const Icon = ICONS[icon ?? "bolt"] ?? Bolt;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="overflow-hidden rounded-[20px] border border-grid-dimmed bg-charcoal-850 p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
    >
      {icon && (
        <motion.div
          variants={item}
          className="mb-4 flex size-10 items-center justify-center rounded-xl border border-grid-bright bg-charcoal-800 text-apple-500"
        >
          <Icon className="size-5" />
        </motion.div>
      )}
      {kicker && (
        <motion.div variants={item} className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-apple-500">
          {kicker}
        </motion.div>
      )}
      <motion.h3
        variants={item}
        className={cn(
          "mb-2 font-title font-semibold tracking-tight text-bright [text-wrap:balance]",
          featured ? "text-3xl leading-[1.1]" : "text-2xl"
        )}
      >
        {title}
      </motion.h3>
      <motion.p variants={item} className="max-w-[60ch] font-sans text-base leading-relaxed text-dimmed">
        {description}
      </motion.p>
    </motion.div>
  );
}
