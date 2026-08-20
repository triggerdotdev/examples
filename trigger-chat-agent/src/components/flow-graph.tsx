"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { easings } from "@/lib/motion";
import { cn } from "@/lib/utils";
import "@xyflow/react/dist/style.css";

/**
 * FlowGraph — a directed node-graph styled like the Trigger.dev dashboard,
 * built on React Flow (`@xyflow/react`) and restyled to the app's shadcn
 * neutral tokens (panel nodes, status dots, dashed edges).
 *
 * The canvas is explorable but scroll-safe: drag to pan, pinch / double-click /
 * the on-canvas buttons to zoom, but the mouse wheel is NEVER captured
 * (`zoomOnScroll`/`panOnScroll` off) so the page keeps scrolling normally over
 * the card. Nodes can't be dragged or selected. Layout is computed once: dagre
 * top-to-bottom for branching graphs, or a serpentine wrap for long straight
 * chains, so nothing renders as one long horizontal ribbon. Nodes reveal in
 * topological order; edges fade in as the reveal cascades. If a `sequence` is
 * supplied, node statuses transition on a timeline (the same shape a Realtime
 * feed would emit) — e.g. running -> success, or error -> paused -> running.
 * Under `prefers-reduced-motion` the graph renders static and fully revealed,
 * with any sequence collapsed to its final per-node status.
 */

export type FlowNodeKind = "task" | "model" | "wait" | "trigger" | "stream" | "queue" | "decision";

export type FlowNodeStatus = "default" | "running" | "error" | "warning" | "success" | "paused";

export type FlowNode = {
  id: string;
  label: string;
  sublabel?: string | null;
  kind: FlowNodeKind;
  status?: FlowNodeStatus | null;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string | null;
  kind?: "default" | "retry" | "stream" | null;
};

export type FlowSeqStep = {
  nodeId: string;
  status: FlowNodeStatus;
  atMs: number;
};

export type FlowGraphProps = {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  sequence?: FlowSeqStep[] | null;
};

// Node chrome classes, from the Launch Week palette: charcoal panels, apple for
// running/success, amber for warning, rose for error.
const statusClasses: Record<FlowNodeStatus, { border: string; dot: string; text: string }> = {
  default: { border: "border-grid-bright", dot: "bg-dimmed", text: "text-bright" },
  running: { border: "border-apple-500/40", dot: "bg-apple-500", text: "text-bright" },
  error: { border: "border-error/30", dot: "bg-error", text: "text-error" },
  warning: { border: "border-warning/30", dot: "bg-warning", text: "text-warning" },
  success: { border: "border-success/30", dot: "bg-success", text: "text-success" },
  paused: { border: "border-warning/30", dot: "bg-warning/70", text: "text-dimmed" },
};

const kindLabels: Record<FlowNodeKind, string> = {
  task: "task",
  model: "model",
  wait: "wait",
  trigger: "trigger",
  stream: "stream",
  queue: "queue",
  decision: "decision",
};

// Colors for the React Flow SVG edge layer (Tailwind classes can't reach
// `.react-flow__edge-path`). Read straight from the brand CSS variables so they
// stay in sync with the palette: charcoal for structure, apple for a stream,
// amber for a retry.
const edgeStroke: Record<"default" | "retry" | "stream", string> = {
  default: "var(--color-charcoal-500)",
  retry: "var(--color-warning)",
  stream: "var(--color-apple-500)",
};

// Node width is MEASURED from the content, not fixed, and the same number is
// used for the dagre layout and the rendered node — if those disagree, dagre
// reserves too little room and siblings on a rank visibly overlap.
const NODE_MIN_WIDTH = 132;
const NODE_MAX_WIDTH = 300;

// Rough advance widths for the fonts in use. They only need to be close: any
// error is absorbed by the layout gaps, and the rendered node is pinned to the
// same computed width, so text truncates rather than overflowing.
const LABEL_CHAR = 7.8; // 14px sans, medium
const KIND_CHAR = 6.7; // 10px mono, uppercase + tracking
const SUB_CHAR = 7.8; // 12px mono + a little safety for tracking/font variance

function nodeWidth(n: FlowNode): number {
  // px-3 padding + status dot + gaps + the kind tag on the right
  const labelRow = 24 + 8 + 8 + n.label.length * LABEL_CHAR + 8 + kindLabels[n.kind].length * KIND_CHAR;
  const subRow = n.sublabel ? 24 + 16 + n.sublabel.length * SUB_CHAR : 0;
  return Math.round(Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, labelRow, subRow)));
}

const nodeHeight = (n: FlowNode) => (n.sublabel ? 64 : 48);

// Layout tuning. Dagre runs top-to-bottom (`TB`) so branching scenes fan out
// horizontally within the column budget while depth grows downward — a narrow
// DAG rather than a wide ribbon. A purely linear chain longer than
// SERPENTINE_PER_ROW would just tower straight down, so those wrap into a
// snaking grid instead (see `serpentineLayout`).
const DAGRE_NODESEP = 22;
const DAGRE_RANKSEP = 38;
const SERPENTINE_PER_ROW = 3;
const SERPENTINE_COL_GAP = 22;
const SERPENTINE_ROW_GAP = 34;

type Pos = { x: number; y: number; width: number; height: number };
type EdgeHandles = { sourceHandle: string; targetHandle: string };
type GraphLayout = { positions: Record<string, Pos>; handles: Record<string, EdgeHandles> };

// Six anchor points per node so edges can enter/leave from whichever side the
// layout needs: top-to-bottom for the dagre DAG, left/right (either direction)
// plus a vertical drop for the serpentine snake.
const HANDLE = {
  targetTop: "t-top",
  targetLeft: "t-left",
  targetRight: "t-right",
  sourceBottom: "s-bottom",
  sourceLeft: "s-left",
  sourceRight: "s-right",
} as const;

const edgeKey = (from: string, to: string) => `${from}->${to}`;

type FlowNodeData = {
  label: string;
  sublabel: string | null;
  kind: FlowNodeKind;
  status: FlowNodeStatus;
  revealDelay: number; // seconds
  reduceMotion: boolean;
  width: number; // the width dagre laid out with — the node must match it
};
type FlowRFNode = Node<FlowNodeData, "flow">;

/** True for a single unbranched chain (each node ≤1 in, ≤1 out, one source,
 * one sink, edges === nodes-1) — the shape that should wrap rather than tower. */
function isLinearPath(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  if (nodes.length < 2 || edges.length !== nodes.length - 1) return false;
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    outdeg.set(n.id, 0);
  }
  for (const e of edges) {
    outdeg.set(e.from, (outdeg.get(e.from) ?? 0) + 1);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const within = nodes.every((n) => (indeg.get(n.id) ?? 0) <= 1 && (outdeg.get(n.id) ?? 0) <= 1);
  const sources = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).length;
  const sinks = nodes.filter((n) => (outdeg.get(n.id) ?? 0) === 0).length;
  return within && sources === 1 && sinks === 1;
}

/** Node ids in topological (path) order. */
function orderedIds(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  return Array.from(topoOrder(nodes, edges).entries())
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}

/** Dagre top-to-bottom layout for branched / short graphs. Edges drop from the
 * bottom of one node into the top of the next. */
function dagreLayout(nodes: FlowNode[], edges: FlowEdge[]): GraphLayout {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: DAGRE_NODESEP,
    ranksep: DAGRE_RANKSEP,
    marginx: 8,
    marginy: 8,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: nodeWidth(n), height: nodeHeight(n) });
  for (const e of edges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const positions: Record<string, Pos> = {};
  for (const n of nodes) {
    const dn = g.node(n.id);
    positions[n.id] = dn
      ? { x: dn.x - dn.width / 2, y: dn.y - dn.height / 2, width: dn.width, height: dn.height }
      : { x: 0, y: 0, width: nodeWidth(n), height: nodeHeight(n) };
  }
  const handles: Record<string, EdgeHandles> = {};
  for (const e of edges) {
    handles[edgeKey(e.from, e.to)] = {
      sourceHandle: HANDLE.sourceBottom,
      targetHandle: HANDLE.targetTop,
    };
  }
  return { positions, handles };
}

/** Serpentine (boustrophedon) grid for a long linear chain: rows of
 * SERPENTINE_PER_ROW that snake left→right then right→left, so the chain wraps
 * into a compact block instead of one long line — and the row-to-row link is a
 * clean vertical drop because the snake keeps the ends aligned. */
function serpentineLayout(nodes: FlowNode[], edges: FlowEdge[]): GraphLayout {
  const order = orderedIds(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // One column pitch for the whole grid, sized to the widest node, so a long
  // label in one cell can't overlap its neighbour.
  const widest = Math.max(...nodes.map(nodeWidth));
  const colWidth = widest + SERPENTINE_COL_GAP;
  const rowHeight = 64 + SERPENTINE_ROW_GAP; // tallest node (with sublabel) + gap

  const positions: Record<string, Pos> = {};
  const grid = new Map<string, { row: number; col: number }>();
  order.forEach((id, k) => {
    const row = Math.floor(k / SERPENTINE_PER_ROW);
    const rawCol = k % SERPENTINE_PER_ROW;
    const col = row % 2 === 0 ? rawCol : SERPENTINE_PER_ROW - 1 - rawCol; // snake
    grid.set(id, { row, col });
    const node = byId.get(id);
    positions[id] = {
      // Centre each node in its column so edges meet the middle of the box.
      x: 8 + col * colWidth + (widest - (node ? nodeWidth(node) : widest)) / 2,
      y: 8 + row * rowHeight,
      width: node ? nodeWidth(node) : widest,
      height: node ? nodeHeight(node) : 48,
    };
  });

  const handles: Record<string, EdgeHandles> = {};
  for (const e of edges) {
    const a = grid.get(e.from);
    const b = grid.get(e.to);
    if (!a || !b) {
      handles[edgeKey(e.from, e.to)] = {
        sourceHandle: HANDLE.sourceRight,
        targetHandle: HANDLE.targetLeft,
      };
      continue;
    }
    if (a.row !== b.row) {
      handles[edgeKey(e.from, e.to)] = {
        sourceHandle: HANDLE.sourceBottom,
        targetHandle: HANDLE.targetTop,
      };
    } else if (b.col > a.col) {
      handles[edgeKey(e.from, e.to)] = {
        sourceHandle: HANDLE.sourceRight,
        targetHandle: HANDLE.targetLeft,
      };
    } else {
      handles[edgeKey(e.from, e.to)] = {
        sourceHandle: HANDLE.sourceLeft,
        targetHandle: HANDLE.targetRight,
      };
    }
  }
  return { positions, handles };
}

/** Pick the layout: wrap long straight chains, dagre-TB everything else. */
function computeLayout(nodes: FlowNode[], edges: FlowEdge[]): GraphLayout {
  if (isLinearPath(nodes, edges) && nodes.length > SERPENTINE_PER_ROW) {
    return serpentineLayout(nodes, edges);
  }
  return dagreLayout(nodes, edges);
}

/** Kahn topological order → reveal index per node (cycle leftovers appended). */
function topoOrder(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!adj.has(e.from) || !indegree.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const q = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order = new Map<string, number>();
  let i = 0;
  while (q.length > 0) {
    const id = q.shift()!;
    if (order.has(id)) continue;
    order.set(id, i++);
    for (const to of adj.get(id) ?? []) {
      indegree.set(to, (indegree.get(to) ?? 1) - 1);
      if ((indegree.get(to) ?? 0) === 0) q.push(to);
    }
  }
  for (const n of nodes) if (!order.has(n.id)) order.set(n.id, i++);
  return order;
}

/** Initial statuses; under reduced-motion a sequence collapses to final. */
function initialStatuses(
  nodes: FlowNode[],
  sequence: FlowSeqStep[] | null | undefined,
  reduceMotion: boolean
): Record<string, FlowNodeStatus> {
  const base: Record<string, FlowNodeStatus> = {};
  for (const n of nodes) base[n.id] = n.status ?? "default";
  if (reduceMotion && sequence) {
    for (const step of [...sequence].sort((a, b) => a.atMs - b.atMs)) {
      if (step.nodeId in base) base[step.nodeId] = step.status;
    }
  }
  return base;
}

function StatusDot({ status, reduceMotion }: { status: FlowNodeStatus; reduceMotion: boolean }) {
  const s = statusClasses[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {status === "running" && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full bg-apple-500"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: easings.outExpo }}
        />
      )}
      <span className={cn("relative h-2 w-2 rounded-full", s.dot)} />
    </span>
  );
}

/** Custom React Flow node — a panel with a status dot + labels. */
function FlowNodeCard({ data, id }: NodeProps<FlowRFNode>) {
  const s = statusClasses[data.status];
  const tooltipId = `flow-node-${id}-details`;
  return (
    <motion.div
      // Rise + fade + settle, no overshoot (scale climbs 0.96 -> 1 and stops).
      initial={data.reduceMotion ? false : { opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        data.reduceMotion ? { duration: 0 } : { delay: data.revealDelay, duration: 0.35, ease: easings.outExpo }
      }
      style={{ width: data.width }}
      tabIndex={0}
      aria-describedby={data.sublabel ? tooltipId : undefined}
      aria-label={`${data.label}, ${kindLabels[data.kind]}${data.sublabel ? `, ${data.sublabel}` : ""}`}
      className={cn(
        "group relative flex flex-col gap-1 rounded-xl border bg-charcoal-800 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-400",
        s.border
      )}
    >
      {/* Anchor points on every side; the layout chooses which pair each edge
          uses (top-to-bottom for the DAG, left/right + drop for serpentine). */}
      <Handle id={HANDLE.targetTop} type="target" position={Position.Top} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle id={HANDLE.targetLeft} type="target" position={Position.Left} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle id={HANDLE.targetRight} type="target" position={Position.Right} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <div className="flex items-center gap-2">
        <StatusDot status={data.status} reduceMotion={data.reduceMotion} />
        <span className={cn("truncate font-sans text-sm font-medium leading-none", s.text)}>{data.label}</span>
        <span className="ml-auto shrink-0 font-mono text-2xs uppercase tracking-wider text-dimmed">
          {kindLabels[data.kind]}
        </span>
      </div>
      {data.sublabel && (
        <>
          <span className="truncate pl-4 font-mono text-xs text-dimmed" title={data.sublabel}>
            {data.sublabel}
          </span>
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-50 hidden w-max max-w-60 -translate-x-1/2 rounded-lg border border-grid-bright bg-popover/95 px-3 py-2 text-left shadow-xl backdrop-blur-md group-focus:flex group-hover:flex"
          >
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-bright">{data.label}</span>
              <span className="whitespace-normal font-mono text-xs leading-5 text-dimmed">{data.sublabel}</span>
            </span>
          </span>
        </>
      )}
      <Handle id={HANDLE.sourceBottom} type="source" position={Position.Bottom} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle id={HANDLE.sourceLeft} type="source" position={Position.Left} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <Handle id={HANDLE.sourceRight} type="source" position={Position.Right} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </motion.div>
  );
}

// Defined at module scope so React Flow gets a stable reference (a new object
// every render triggers its "nodeTypes changed" warning + remounts).
const nodeTypes = { flow: FlowNodeCard };

export function FlowGraph({ title, nodes, edges, sequence }: FlowGraphProps) {
  const reduceMotion = !!useReducedMotion();

  // Stream re-renders hand us fresh array identities with identical content (the
  // message part is re-cloned per streamed token). Key the expensive layout and
  // the status timeline on the CONTENT, not the array reference, so dagre isn't
  // re-run and an in-flight animation doesn't reset to t=0 on every token.
  const nodesSig = nodes
    .map((n) => `${n.id}|${n.label}|${n.sublabel ?? ""}|${n.kind}|${n.status ?? ""}`)
    .join(";");
  const edgesSig = edges
    .map((e) => `${e.from}>${e.to}|${e.kind ?? ""}|${e.label ?? ""}`)
    .join(";");
  const sequenceSig = (sequence ?? [])
    .map((s) => `${s.nodeId}|${s.status}|${s.atMs}`)
    .join(";");

  // Robustness guard: a model can emit an edge whose `from`/`to` doesn't match
  // any node id (typo, stale reference, partial catalog data). React Flow
  // doesn't validate this itself — an edge pointing at a missing node id can
  // throw during rendering. Drop those edges before they reach layout, the
  // topo sort, or React Flow; every downstream computation uses this filtered
  // list instead of the raw `edges` prop.
  const safeEdges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesSig, edgesSig]);

  const { positions, handles: edgeHandles } = useMemo(
    () => computeLayout(nodes, safeEdges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesSig, safeEdges]
  );

  const revealDelays = useMemo(() => {
    const order = topoOrder(nodes, safeEdges);
    const maxOrder = Math.max(1, ...Array.from(order.values()));
    const step = Math.min(0.09, 0.5 / maxOrder); // keep the whole cascade tight
    const out: Record<string, number> = {};
    for (const [id, o] of order) out[id] = 0.1 + o * step;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesSig, safeEdges]);

  const [statuses, setStatuses] = useState<Record<string, FlowNodeStatus>>(() =>
    initialStatuses(nodes, sequence, reduceMotion)
  );

  // Genuine side effect: drive the timed status transitions. Reduced-motion
  // path applies the final statuses synchronously and schedules nothing.
  useEffect(() => {
    setStatuses(initialStatuses(nodes, sequence, reduceMotion));
    if (reduceMotion || !sequence || sequence.length === 0) return;
    const timers = sequence.map((s) =>
      window.setTimeout(() => {
        setStatuses((prev) => (s.nodeId in prev ? { ...prev, [s.nodeId]: s.status } : prev));
      }, Math.max(0, s.atMs))
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesSig, sequenceSig, reduceMotion]);

  // Edges fade in mid-cascade so they don't dangle off still-hidden nodes.
  const [edgesVisible, setEdgesVisible] = useState(reduceMotion);
  const revealSpan = useMemo(() => Math.max(0, ...Object.values(revealDelays)), [revealDelays]);
  useEffect(() => {
    if (reduceMotion) {
      setEdgesVisible(true);
      return;
    }
    setEdgesVisible(false);
    // revealDelays are in SECONDS; the last node starts at ~revealSpan*1000ms,
    // so wait until it's begun animating in before the edges appear.
    const t = window.setTimeout(() => setEdgesVisible(true), revealSpan * 1000 + 150);
    return () => window.clearTimeout(t);
  }, [reduceMotion, revealSpan]);

  const rfNodes: FlowRFNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "flow",
        position: { x: positions[n.id]?.x ?? 0, y: positions[n.id]?.y ?? 0 },
        data: {
          label: n.label,
          sublabel: n.sublabel ?? null,
          kind: n.kind,
          status: statuses[n.id] ?? "default",
          revealDelay: revealDelays[n.id] ?? 0,
          reduceMotion,
          // Same value the layout used, so the box can't outgrow its slot.
          width: positions[n.id]?.width ?? nodeWidth(n),
        },
        draggable: false,
        selectable: false,
        connectable: false,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodesSig, positions, statuses, revealDelays, reduceMotion]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      safeEdges.map((e, i) => {
        const kind = e.kind ?? "default";
        const handles = edgeHandles[edgeKey(e.from, e.to)];
        return {
          id: `e${i}-${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          sourceHandle: handles?.sourceHandle,
          targetHandle: handles?.targetHandle,
          label: e.label ?? undefined,
          type: "smoothstep",
          animated: kind !== "default" && !reduceMotion,
          style: {
            stroke: edgeStroke[kind],
            strokeWidth: 1.5,
            strokeDasharray: kind === "retry" ? "4 4" : undefined,
            opacity: edgesVisible ? 1 : 0,
            transition: reduceMotion ? undefined : "opacity 300ms ease",
          },
          labelStyle: { fill: "var(--color-dimmed)", fontSize: 11, fontFamily: "monospace" },
          labelBgStyle: { fill: "var(--color-charcoal-850)" },
          labelBgPadding: [4, 2] as [number, number],
        };
      }),
    [safeEdges, edgeHandles, edgesVisible, reduceMotion]
  );

  const height = useMemo(() => {
    const bottoms = nodes.map((n) => (positions[n.id]?.y ?? 0) + (positions[n.id]?.height ?? 48));
    const maxY = Math.max(0, ...bottoms);
    return Math.min(480, Math.max(180, maxY + 24));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesSig, positions]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: easings.outExpo }}
      className="col-span-full w-full min-w-0 overflow-hidden rounded-2xl border border-grid-dimmed bg-charcoal-850"
    >
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-grid-bright bg-charcoal-800 px-5 py-3">
        <span className="font-title text-sm font-medium text-bright/80">{title}</span>
      </div>
      <div style={{ height }} className="bg-charcoal-850">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          // Less margin + a legibility floor (minZoom) so a wide graph isn't
          // shrunk to mush; it overflows and the reader pans/zooms to explore.
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // Explorable but scroll-safe: drag-pan + pinch/double-click zoom, but
          // the wheel is left to the page (zoomOnScroll/panOnScroll off), so
          // scrolling over the card never gets trapped.
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.5}
          maxZoom={1.75}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-charcoal-700)" />
          <Controls
            showInteractive={false}
            position="bottom-right"
            className="!m-3 !overflow-hidden !rounded-lg !border !border-charcoal-700 !shadow-none [&_button]:!size-8 [&_button]:!border-charcoal-700 [&_button]:!bg-charcoal-800/90 [&_button:hover]:!bg-charcoal-700 [&_button_svg]:!max-h-3.5 [&_button_svg]:!max-w-3.5 [&_button_svg]:!fill-dimmed [&_button:hover_svg]:!fill-bright"
          />
        </ReactFlow>
      </div>
    </motion.div>
  );
}
