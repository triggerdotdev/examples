import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

// ============================================================================
// Shared json-render catalog — imported by BOTH the Trigger.dev agent (to
// describe and validate the renderVisualization tool input) and the Next.js
// app (to build the component registry that renders the spec).
// Must stay React-free so the agent can import it in Node.
//
// Adapted from the sibling `clickhouse-chat-agent` example (json-render's own
// reference implementation): the analytics chart set is swapped for a
// "learn Trigger.dev by drawing" card set — an interactive FlowGraph, plus
// code / diagram / prompt / stat cards.
// ============================================================================

// Node kinds + visual states for a `FlowGraph`. `status` extends the linear
// DiagramCard set (`stepStatus`) with `running` (in-flight) and `paused`
// (waiting / checkpointed).
const flowNodeKind = z.enum(["task", "model", "wait", "trigger", "stream", "queue", "decision"]);
const flowNodeStatus = z.enum(["default", "running", "error", "warning", "success", "paused"]);
const stepStatus = z.enum(["default", "error", "warning", "success"]);

// Fields nested inside arrays use `.nullish()` (not `.nullable()`):
// `validateSpec`'s null-fill only patches missing top-level element props,
// not array items — `.nullish()` lets the model omit the key entirely.
const flowNode = z.object({
  id: z.string(),
  label: z.string().describe("Short node label, e.g. 'triage', 'Attempt 1'"),
  sublabel: z.string().nullish().describe("Optional second line, e.g. 'Haiku' or '1.4s'"),
  kind: flowNodeKind,
  status: flowNodeStatus.nullish().describe("Visual state, defaults to 'default'"),
});

const flowEdge = z.object({
  from: z.string().describe("Source node id"),
  to: z.string().describe("Target node id"),
  label: z.string().nullish(),
  kind: z.enum(["default", "retry", "stream"]).nullish().describe("Edge style, defaults to 'default'"),
});

const flowSeqStep = z.object({
  nodeId: z.string(),
  status: flowNodeStatus,
  atMs: z.number().describe("Milliseconds from reveal start when this node takes this status"),
});

const diagramStep = z.object({
  label: z.string().describe("Short step label, e.g. 'Attempt 1', 'Backoff', 'Success'"),
  status: stepStatus.nullish().describe("Visual state of this step, defaults to 'default' (neutral grey)"),
});

export const cardComponentDefinitions = {
  Stat: {
    props: z.object({
      label: z.string(),
      value: z.string().describe("The headline value, pre-formatted (e.g. '5s', '10k/min', '3x')"),
      caption: z.string().nullable().describe("Small print under the value, e.g. a comparison"),
    }),
    description: "A single big-number stat. Use a Grid of Stats for a row of KPIs.",
  },
  FlowGraph: {
    props: z.object({
      title: z.string().describe("Card title, e.g. 'Fan-out with retries', 'This conversation'"),
      nodes: z.array(flowNode).describe("Graph nodes"),
      edges: z.array(flowEdge).describe("Directed edges between node ids"),
      sequence: z
        .array(flowSeqStep)
        .nullable()
        .describe("Optional animation script: node status transitions over time. Omit for a static reveal."),
    }),
    description:
      "A directed node-graph (React Flow) styled like the Trigger.dev dashboard: rectangular " +
      "nodes with a status dot, orthogonal edges, animated reveal. Use for architecture, task " +
      "orchestration, fan-out, retries, waits, checkpoints, or queues — anything with branching " +
      "or a real flow. Prefer this over DiagramCard for non-trivial diagrams.",
  },
  DiagramCard: {
    props: z.object({
      title: z.string().describe("Card title, e.g. 'Task lifecycle'"),
      steps: z
        .array(diagramStep)
        .describe("Left-to-right sequence of steps, e.g. Triggered -> Attempt 1 -> Fails -> Backoff -> Success"),
    }),
    description:
      "A card with a horizontal step-flow of colored status dots for a simple linear sequence. " +
      "Use for a short lifecycle track; prefer FlowGraph for architecture, branching, or fan-out.",
  },
  CodeCard: {
    props: z.object({
      title: z.string().nullable().describe("Optional title shown in the window chrome, e.g. 'trigger/hello.ts'"),
      language: z.string().nullable().describe("Syntax highlighting language, defaults to 'typescript'"),
      code: z.string().describe("The code to display"),
    }),
    description: "A code snippet in a terminal-style window with macOS traffic-light dots. For code the user reads.",
  },
  PromptCard: {
    props: z.object({
      title: z.string().describe("Short title, e.g. 'Build this with Trigger.dev'"),
      prompt: z.string().describe("The paste-ready prompt text"),
      caption: z.string().nullable().describe("Optional caption; defaults to the paste hint"),
    }),
    description:
      "A copy-paste prompt block with a one-click Copy button. Use to hand the user a ready prompt " +
      "to paste into Claude Code, Cursor, or any coding agent to build the thing being discussed. " +
      "Distinct from CodeCard: code is read, this is taken.",
  },
} as const;

export const catalog = defineCatalog(schema, {
  components: {
    // Layout & text from the stock shadcn catalog
    Card: shadcnComponentDefinitions.Card,
    Stack: shadcnComponentDefinitions.Stack,
    Grid: shadcnComponentDefinitions.Grid,
    Heading: shadcnComponentDefinitions.Heading,
    Text: shadcnComponentDefinitions.Text,
    Badge: shadcnComponentDefinitions.Badge,
    Separator: shadcnComponentDefinitions.Separator,
    // Custom Trigger.dev teaching cards
    ...cardComponentDefinitions,
  },
  actions: {},
});

export type VisualizationSpec = {
  root: string;
  elements: Record<
    string,
    {
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
};

// ============================================================================
// Prompt + validation helpers for the agent side
// ============================================================================

/**
 * A compact reference of the spec format and every component's props,
 * generated from the catalog so prompt and validation can't drift apart.
 */
export function catalogPromptSection(): string {
  const components = Object.entries(catalog.data.components)
    .map(([name, def]) => {
      const jsonSchema = z.toJSONSchema(def.props as z.ZodType, { io: "input" });
      delete jsonSchema.$schema;
      return `### ${name}\n${def.description}\nProps schema: ${JSON.stringify(jsonSchema)}`;
    })
    .join("\n\n");

  return `The spec is a flat element map:
{ "root": "<key of root element>", "elements": { "<key>": { "type": "<ComponentName>", "props": { ... }, "children": ["<child key>", ...] } } }

- Every key referenced in "children" or "root" must exist in "elements".
- Only Card, Stack, and Grid take children; other components are leaves (omit "children" or pass []).
- Props marked nullable may be omitted or null.
- Prefer FlowGraph for architecture/orchestration/branching, DiagramCard for a simple linear lifecycle, CodeCard for a snippet, Stat for a headline number, PromptCard to hand over a build prompt.

Available components:

${components}`;
}

/**
 * Accepts a spec-shaped value, tolerating one accidental extra `{ spec: ... }`
 * wrapping (models occasionally double-nest the tool input). Used by both the
 * agent tool and the client renderer so they can't disagree on the shape.
 */
export function normalizeSpec(input: unknown): VisualizationSpec | null {
  const looksLikeSpec = (v: unknown): v is VisualizationSpec =>
    typeof v === "object" &&
    v !== null &&
    typeof (v as VisualizationSpec).root === "string" &&
    typeof (v as VisualizationSpec).elements === "object" &&
    (v as VisualizationSpec).elements !== null;

  if (looksLikeSpec(input)) return input;
  const inner = (input as { spec?: unknown } | null)?.spec;
  if (looksLikeSpec(inner)) return inner;
  return null;
}

/**
 * Validates a spec against the catalog: known component types, per-component
 * props (missing nullable props are treated as null), and resolvable children.
 * Returns errors phrased for the model to correct and retry.
 */
export function validateSpec(spec: VisualizationSpec): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const components = catalog.data.components as Record<
    string,
    { props: z.ZodObject<Record<string, z.ZodType>> }
  >;

  if (!spec.elements[spec.root]) {
    errors.push(`root "${spec.root}" is not a key in elements`);
  }

  for (const [key, element] of Object.entries(spec.elements)) {
    const definition = components[element.type];
    if (!definition) {
      errors.push(
        `elements.${key}: unknown component type "${element.type}" (available: ${Object.keys(components).join(", ")})`
      );
      continue;
    }

    // Missing nullable props default to null so the model can omit them.
    const props: Record<string, unknown> = { ...element.props };
    for (const [propName, propSchema] of Object.entries(definition.props.shape)) {
      if (!(propName in props) && propSchema.safeParse(null).success) {
        props[propName] = null;
      }
    }

    const parsed = definition.props.safeParse(props);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`elements.${key} (${element.type}) props.${issue.path.join(".")}: ${issue.message}`);
      }
    }

    for (const child of element.children ?? []) {
      if (!spec.elements[child]) {
        errors.push(`elements.${key}: child "${child}" is not a key in elements`);
      }
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
