"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The thinking constellation from the Launch Week 3 chat.
 *
 * Twelve dots continuously morph through circle -> triangle -> square while a
 * soft pulse travels around them. The document's rAF clock drives the phase,
 * so switching chats while a turn is running doesn't restart the mark at frame
 * zero.
 */
export function ThinkingOrb({
  reduced = false,
  className,
}: {
  reduced?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cssWidth = 1;
    let cssHeight = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(rect.width, 1);
      cssHeight = Math.max(rect.height, 1);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = Math.round(cssWidth * dpr);
      const height = Math.round(cssHeight * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number, active: number, orbitTurns: number) => {
      const size = Math.min(cssWidth, cssHeight);
      const centerX = cssWidth / 2;
      const centerY = cssHeight / 2;
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const points: Point[] = [];
      for (let i = 0; i < OUTLINE_SAMPLES; i++) {
        const f = i / OUTLINE_SAMPLES;
        points.push(mixPoint(REST_PATH(f), thinkingPathAt(time, f), active));
      }

      const lengths: number[] = [];
      let total = 0;
      for (let i = 0; i < OUTLINE_SAMPLES; i++) {
        const a = points[i];
        const b = points[(i + 1) % OUTLINE_SAMPLES];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        lengths.push(length);
        total += length;
      }

      const orbit = ((orbitTurns % 1) + 1) % 1;
      const baseRadius = Math.max(0.75, size * 0.043);
      let edge = 0;
      let accumulated = 0;

      for (let dot = 0; dot < DOT_COUNT; dot++) {
        const fraction = (dot / DOT_COUNT + orbit) % 1;
        const target = fraction * total;

        if (target < accumulated) {
          edge = 0;
          accumulated = 0;
        }
        while (
          edge < OUTLINE_SAMPLES - 1 &&
          accumulated + lengths[edge] < target
        ) {
          accumulated += lengths[edge];
          edge += 1;
        }

        const a = points[edge];
        const b = points[(edge + 1) % OUTLINE_SAMPLES];
        const progress = lengths[edge]
          ? Math.min(1, (target - accumulated) / lengths[edge])
          : 0;
        const point = mixPoint(a, b, progress);
        const wave =
          (Math.sin(TAU * (dot / DOT_COUNT - time * 0.72 * TEMPO)) + 1) / 2;
        const radius = baseRadius * (1 + active * (wave * 0.42 - 0.12));
        const alpha = 0.82 + active * (wave * 0.18 - 0.28);

        ctx.beginPath();
        ctx.arc(
          centerX + point[0] * size,
          centerY + point[1] * size,
          radius,
          0,
          TAU,
        );
        ctx.fillStyle = `rgba(${APPLE_500}, ${alpha})`;
        ctx.fill();
      }
    };

    resize();

    if (reduced) {
      draw(0, 0, 0);
      const resizeObserver = new ResizeObserver(() => {
        resize();
        draw(0, 0, 0);
      });
      resizeObserver.observe(canvas);
      return () => resizeObserver.disconnect();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const tick = (timeMs: number) => {
      const seconds = timeMs / 1000;
      draw(seconds, 1, seconds * ORBIT_TURNS_PER_SECOND);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block size-8 shrink-0", className)}
    />
  );
}

type Point = readonly [number, number];
type Path = (f: number) => Point;

const TAU = Math.PI * 2;
const MAX_DPR = 2;
const DOT_COUNT = 12;
const OUTLINE_SAMPLES = 144;
const APPLE_500 = "168, 255, 83";

function polyPath(vertices: readonly Point[]): Path {
  const lengths: number[] = [];
  let total = 0;

  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(length);
    total += length;
  }

  return (f) => {
    let target = f * total;
    let edge = 0;
    while (edge < vertices.length - 1 && target > lengths[edge]) {
      target -= lengths[edge];
      edge += 1;
    }
    const a = vertices[edge];
    const b = vertices[(edge + 1) % vertices.length];
    const progress = lengths[edge]
      ? Math.min(1, target / lengths[edge])
      : 0;
    return [
      a[0] + (b[0] - a[0]) * progress,
      a[1] + (b[1] - a[1]) * progress,
    ];
  };
}

const CIRCLE: Path = (f) => {
  const angle = -Math.PI / 2 + f * TAU;
  return [Math.cos(angle) * 0.27, Math.sin(angle) * 0.27];
};

const TRIANGLE = polyPath([
  [0, -0.29],
  [0.265, 0.17],
  [-0.265, 0.17],
]);

const SQUARE = polyPath([
  [0, -0.225],
  [0.225, -0.225],
  [0.225, 0.225],
  [-0.225, 0.225],
  [-0.225, -0.225],
]);

const CYCLE: Path[] = [CIRCLE, TRIANGLE, SQUARE];
const REST_PATH = TRIANGLE;
const TEMPO = 1.5;
const SHAPE_SECONDS = 0.82 / TEMPO;
const ORBIT_TURNS_PER_SECOND = 0.09 * TEMPO;

function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function mixPoint(a: Point, b: Point, amount: number): Point {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function thinkingPathAt(time: number, f: number): Point {
  const position = time / SHAPE_SECONDS;
  const shape = Math.floor(position) % CYCLE.length;
  const progress = easeInOut(position - Math.floor(position));
  return mixPoint(
    CYCLE[shape](f),
    CYCLE[(shape + 1) % CYCLE.length](f),
    progress,
  );
}
