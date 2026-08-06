"use client";

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { CodeCard } from "@/components/code-card";
import { DiagramCard } from "@/components/diagram-card";
import { FlowGraph } from "@/components/flow-graph";
import { PromptCard } from "@/components/prompt-card";
import { StatView } from "@/components/stat";
import { catalog } from "./catalog";

export const { registry } = defineRegistry(catalog, {
  components: {
    Card: shadcnComponents.Card,
    Stack: shadcnComponents.Stack,
    Grid: shadcnComponents.Grid,
    Heading: shadcnComponents.Heading,
    Text: shadcnComponents.Text,
    Badge: shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,
    Stat: ({ props }) => <StatView {...props} />,
    FlowGraph: ({ props }) => (
      <FlowGraph title={props.title} nodes={props.nodes} edges={props.edges} sequence={props.sequence} />
    ),
    DiagramCard: ({ props }) => <DiagramCard title={props.title} steps={props.steps} />,
    CodeCard: ({ props }) => <CodeCard title={props.title} language={props.language} code={props.code} />,
    PromptCard: ({ props }) => <PromptCard title={props.title} prompt={props.prompt} caption={props.caption} />,
  },
});
