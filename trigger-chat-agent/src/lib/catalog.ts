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
  label: z
    .string()
    .max(22)
    .describe("Node label — 1-3 words, max 22 chars, e.g. 'triage', 'Attempt 1'. Longer labels get truncated."),
  sublabel: z
    .string()
    .max(24)
    .nullish()
    .describe("Optional second line, max 24 chars, e.g. 'Haiku' or '1.4s'. Put detail here, not in the label."),
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
  HeroCard: {
    props: z.object({
      icon: z
        .enum(["bolt", "server", "cpu", "clock", "rocket", "command", "cog", "database", "chart", "shield", "signal", "check"])
        .nullable()
        .describe("Icon badge above the title, defaults to 'bolt'"),
      kicker: z.string().nullable().describe("Small mono label above the title, e.g. 'Core concept'"),
      title: z.string().describe("Short headline, e.g. 'The task lifecycle'"),
      description: z.string().describe("One or two sentence summary"),
      featured: z.boolean().nullable().describe("Larger type for the single lead card that opens an answer"),
    }),
    description:
      "Large intro card with an icon badge, a kicker, a title and a blurb. Use to OPEN a topic or an answer.",
  },
  StatCard: {
    props: z.object({
      label: z.string().describe("Small uppercase label, e.g. 'Cold start'"),
      value: z.string().describe("Pre-formatted headline value, e.g. '300ms', '10k/min', '3x'"),
      deltaLabel: z.string().nullable().describe("Small badge next to the label, e.g. '+340%'"),
      deltaPositive: z.boolean().nullable().describe("Colors the delta apple (true) or red (false)"),
      bars: z
        .array(z.number())
        .nullable()
        .describe("Relative heights for a mini bar chart, e.g. [20, 45, 30, 80, 60, 95]. Omit for no chart."),
    }),
    description: "A single KPI stat: a headline number (counts up) with an optional delta badge and mini bar chart.",
  },
  FlowGraph: {
    props: z.object({
      title: z.string().describe("Card title, e.g. 'Fan-out with retries', 'This conversation'"),
      nodes: z.array(flowNode).describe("Graph nodes"),
      edges: z
    .array(flowEdge)
    .describe(
      "Directed edges between node ids. Keep the graph readable: at most ~10 nodes, and at most 3 " +
        "branches from any one node — wide fan-outs get cramped in a chat column."
    ),
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
    description: "A syntax-highlighted code panel for code the user reads.",
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
  Quiz: {
    props: z.object({
      question: z.string(),
      options: z
        .array(
          z.object({
            text: z.string(),
            correct: z.boolean().nullish().describe("Set true on exactly one option"),
          })
        )
        .describe("2-4 options, exactly one correct. Keep them similar in length so formatting doesn't hint the answer."),
      explanation: z.string().nullable().describe("Shown after answering — why the answer is right"),
    }),
    description:
      "A single multiple-choice question with immediate feedback. Use to reinforce a concept with retrieval practice.",
  },
  Callout: {
    props: z.object({
      variant: z.enum(["tip", "warn", "note"]).nullable().describe("tip (apple), warn (amber), note (grey). Default note."),
      title: z.string().nullable(),
      text: z.string(),
    }),
    description: "A tip / warning / note box for a caveat or gotcha.",
  },
  Steps: {
    props: z.object({
      steps: z.array(z.object({ title: z.string(), text: z.string() })).describe("Ordered walkthrough steps"),
    }),
    description:
      "A numbered vertical walkthrough — 'do this, then this'. For an ordered procedure (distinct from DiagramCard's status track).",
  },
  Glossary: {
    props: z.object({
      terms: z.array(z.object({ term: z.string(), definition: z.string() })).describe("Term → definition pairs"),
    }),
    description: "A term/definition list for Trigger.dev nomenclature (task, run, attempt, waitpoint, queue…).",
  },
  Compare: {
    props: z.object({
      title: z.string().nullable(),
      a: z.object({ label: z.string(), points: z.array(z.string()) }),
      b: z.object({ label: z.string(), points: z.array(z.string()) }),
    }),
    description: "A two-column comparison, e.g. 'batchTrigger vs a loop'. Each column has a label and bullet points.",
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
- Prefer FlowGraph for architecture/orchestration/branching, DiagramCard for a simple linear lifecycle, CodeCard for a snippet, StatCard for a headline number, PromptCard to hand over a build prompt.

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
