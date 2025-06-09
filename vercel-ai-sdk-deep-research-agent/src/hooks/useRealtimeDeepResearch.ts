"use client";

import type { deepResearch } from "@/trigger/deepResearch";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

type UseDeepResearchInstance = {
  progress: number;
  label: string;
};

export function useRealtimeDeepResearch(
  runId?: string,
  accessToken?: string,
): UseDeepResearchInstance {
  const { run, error } = useRealtimeRun<typeof deepResearch>(runId, {
    accessToken,
    baseURL: process.env.NEXT_PUBLIC_TRIGGER_API_URL,
    enabled: !!runId && !!accessToken,
  });

  if (!run) {
    return { progress: 0, label: " " };
  }

  const label = run.metadata?.label as string;
  const progress = run.metadata?.progress as number;

  return {
    progress,
    label,
  };
}
