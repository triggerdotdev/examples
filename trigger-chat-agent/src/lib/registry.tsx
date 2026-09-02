"use client";

import { defineRegistry } from "@json-render/react";
import { shadcnComponents } from "@json-render/shadcn";
import { CodeCard } from "@/components/code-card";
import { DiagramCard } from "@/components/diagram-card";
import { FlowGraph } from "@/components/flow-graph";
import { HeroCard } from "@/components/hero-card";
import { PromptCard } from "@/components/prompt-card";
import { Quiz } from "@/components/quiz";
import { useVisualizationElementKey } from "@/components/visualization-element-key";
import { StatCard } from "@/components/stat-card";
import { Callout, Compare, Glossary, Steps } from "@/components/teaching-cards";
import { catalog } from "./catalog";

type QuizProps = {
  question: string;
  options: { text: string; correct?: boolean | null }[];
  explanation?: string | null;
};

function QuizRenderer({ props }: { props: QuizProps }) {
  const quizKey = useVisualizationElementKey(props);
  const { question, options, explanation } = props;
  return (
    <Quiz
      quizKey={quizKey}
      question={question}
      options={options}
      explanation={explanation}
    />
  );
}

export const { registry } = defineRegistry(catalog, {
  components: {
    Card: shadcnComponents.Card,
    Stack: shadcnComponents.Stack,
    Grid: shadcnComponents.Grid,
    Heading: shadcnComponents.Heading,
    Text: shadcnComponents.Text,
    Badge: shadcnComponents.Badge,
    Separator: shadcnComponents.Separator,
    HeroCard: ({ props }) => (
      <HeroCard icon={props.icon} kicker={props.kicker} title={props.title} description={props.description} featured={props.featured} />
    ),
    StatCard: ({ props }) => (
      <StatCard label={props.label} value={props.value} deltaLabel={props.deltaLabel} deltaPositive={props.deltaPositive} bars={props.bars} />
    ),
    FlowGraph: ({ props }) => (
      <FlowGraph title={props.title} nodes={props.nodes} edges={props.edges} sequence={props.sequence} />
    ),
    DiagramCard: ({ props }) => <DiagramCard title={props.title} steps={props.steps} />,
    CodeCard: ({ props }) => <CodeCard title={props.title} language={props.language} code={props.code} />,
    PromptCard: ({ props }) => <PromptCard title={props.title} prompt={props.prompt} caption={props.caption} />,
    Quiz: QuizRenderer,
    Callout: ({ props }) => <Callout variant={props.variant} title={props.title} text={props.text} />,
    Steps: ({ props }) => <Steps steps={props.steps} />,
    Glossary: ({ props }) => <Glossary terms={props.terms} />,
    Compare: ({ props }) => <Compare title={props.title} a={props.a} b={props.b} />,
  },
});
