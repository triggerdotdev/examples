"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** A compact version of the fluid Trigger orb used as the agent's working state. */
export function ThinkingOrb({
  reduced = false,
  className,
}: {
  reduced?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative isolate block size-8 shrink-0 overflow-hidden rounded-full border border-apple-400/25 bg-charcoal-950 shadow-[0_0_20px_rgba(168,255,83,0.18)]",
        className,
      )}
    >
      <motion.span
        className="absolute -inset-3 rounded-full opacity-95 blur-[3px]"
        style={{
          background:
            "conic-gradient(from 35deg, #41ff54 0deg, #e7ff52 105deg, #7655fd 225deg, #41ff54 360deg)",
        }}
        animate={
          reduced
            ? undefined
            : { rotate: 360, scale: [0.92, 1.08, 0.92] }
        }
        transition={{
          rotate: { duration: 3.2, repeat: Infinity, ease: "linear" },
          scale: { duration: 2.1, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.span
        className="absolute -left-1 top-1 size-6 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.95),rgba(231,255,82,0.78)_22%,rgba(65,255,84,0.15)_62%,transparent_72%)] blur-[1px]"
        animate={
          reduced
            ? undefined
            : {
                x: [0, 7, 3, 0],
                y: [0, 4, 9, 0],
                scale: [1, 0.82, 1.08, 1],
              }
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute -bottom-1 -right-1 size-6 rounded-full bg-lavender-500/55 blur-[4px]"
        animate={
          reduced
            ? undefined
            : { x: [0, -5, 0], y: [0, -6, 0], scale: [0.9, 1.15, 0.9] }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="absolute inset-[1px] rounded-full shadow-[inset_-4px_-5px_10px_rgba(11,12,15,0.6),inset_3px_3px_6px_rgba(255,255,255,0.18)]" />
      <span className="absolute left-[7px] top-[5px] size-1.5 rounded-full bg-white/80 blur-[0.5px]" />
    </span>
  );
}
