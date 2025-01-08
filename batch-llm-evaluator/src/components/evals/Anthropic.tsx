"use client";
import EvalCard from "@/components/EvalCard";
import type { evaluateAnthropic, STREAMS } from "@/trigger/batch";
import { useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import type { RealtimeRun } from "@trigger.dev/sdk/v3";

export default function AnthropicEval({
  run,
  accessToken,
  isSelected,
  tag,
}: {
  run: RealtimeRun<typeof evaluateAnthropic>;
  accessToken: string;
  isSelected: boolean;
  tag?: string;
}) {
  const { streams } = useRealtimeRunWithStreams<
    typeof evaluateAnthropic,
    STREAMS
  >(run.id, {
    accessToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
  });

  const response =
    streams.llm
      ?.filter((part) => part.type === "text-delta")
      .map((part) => part.textDelta)
      .join("") ?? "";

  return (
    <EvalCard
      id={run.id}
      response={response}
      isSelected={isSelected}
      name="Anthropic"
      value="anthropic"
      tag={tag}
    />
  );
}
