import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { z } from "zod";

// ============================================================================
// Shared json-render catalog — imported by BOTH the Trigger.dev agent (to
// describe and validate the renderVisualization tool input) and the Next.js
// app (to build the component registry that renders the spec).
// Must stay React-free so the agent can import it in Node.
// ============================================================================

/** Rows of data points: one record per x-axis entry. */
const chartData = z
  .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
  .describe("Data rows, one object per x-axis entry");

// Nested optional fields use .nullish() (not .nullable()) so the model can
// omit them: the top-level null-fill in validateSpec doesn't recurse into
// arrays, and bare .nullable() rejects a missing key.
const series = z
  .array(
    z.object({
      dataKey: z.string().describe("Key in each data row holding this series' numeric value"),
      label: z.string().nullish().describe("Human-readable series name for legend/tooltip"),
    })
  )
  .describe("One entry per plotted series");

const cartesianChartProps = z.object({
  data: chartData,
  xKey: z.string().describe("Key in each data row to use for the x-axis"),
  series,
  title: z.string().nullable(),
});

export const chartComponentDefinitions = {
  BarChart: {
    props: cartesianChartProps.extend({
      stacked: z.boolean().nullable().describe("Stack the series instead of grouping"),
    }),
    description:
      "Bar chart for comparing values across categories or discrete time buckets. Supports multiple series, optionally stacked.",
  },
  LineChart: {
    props: cartesianChartProps,
    description: "Line chart for trends over a continuous or ordered x-axis (dates, hours).",
  },
  AreaChart: {
    props: cartesianChartProps.extend({
      stacked: z.boolean().nullable().describe("Stack the series to show a total"),
    }),
    description: "Area chart for trends where the magnitude/total matters. Supports stacking.",
  },
  PieChart: {
    props: z.object({
      data: chartData,
      nameKey: z.string().describe("Key in each data row holding the slice name"),
      valueKey: z.string().describe("Key in each data row holding the slice value"),
      title: z.string().nullable(),
    }),
    description:
      "Pie/donut chart for a share-of-total breakdown across a small number (<=8) of categories.",
  },
  Stat: {
    props: z.object({
      label: z.string(),
      value: z.string().describe("The headline value, pre-formatted (e.g. '1.4M', '$23.50')"),
      caption: z.string().nullable().describe("Small print under the value, e.g. a comparison"),
    }),
    description: "A single big-number stat. Use a Grid of Stats for a KPI row.",
  },
  PointMap: {
    props: z.object({
      points: z
        .array(
          z.object({
            lat: z.number(),
            lng: z.number(),
            label: z.string().nullish().describe("Shown in the marker tooltip"),
            value: z
              .number()
              .nullish()
              .describe("Optional magnitude — scales the marker size and shows in the tooltip"),
          })
        )
        .describe("At most ~200 points — aggregate or round coordinates in SQL first"),
      title: z.string().nullable(),
    }),
    description:
      "Interactive geographic map with markers dropped at lat/lng coordinates, auto-fitted to the points. Use for 'where' questions when the data has coordinates.",
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
    Table: shadcnComponentDefinitions.Table,
    // Charts & stats (custom, rendered with shadcn charts + Recharts)
    ...chartComponentDefinitions,
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
- Inline the data rows in chart/table props — components don't fetch anything.

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
