"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Cell } from "./cell";
import { CompanyLogo } from "./company-logo";
import { Loader2, CheckCircle } from "lucide-react";
import type {
  enrichCompany,
  EnrichmentMetadata,
} from "@/trigger/enrich-company";

interface EnrichingRowProps {
  rowIndex: number;
  companyName: string;
  runId: string;
  accessToken: string;
  onComplete: (data: {
    companyName: string;
    website: string | null;
    description: string | null;
    industry: string | null;
    employeeCount: string | null;
    stage: string | null;
    lastRoundAmount: string | null;
    sources: Record<string, string>;
  }) => void;
}

export function EnrichingRow({
  rowIndex,
  companyName,
  runId,
  accessToken,
  onComplete,
}: EnrichingRowProps) {
  // Subscribe to run metadata and status
  const { run, error } = useRealtimeRun<typeof enrichCompany>(runId, {
    accessToken,
    onComplete: (completedRun) => {
      if (completedRun?.output) {
        const data = completedRun.output.data;
        onComplete({
          companyName,
          website: data.website,
          description: data.description,
          industry: data.industry,
          employeeCount: data.employee_count,
          // New fields - will be populated after task updates
          stage: data.stage ?? null,
          lastRoundAmount: data.last_round_amount ?? null,
          sources: data.sources ?? {},
        });
      }
    },
  });

  const meta = run?.metadata as EnrichmentMetadata | undefined;
  const isComplete = run?.status === "COMPLETED";

  return (
    <div className="flex border-b border-border hover:bg-blue-500/5 text-[13px] h-9">
      {/* Row number */}
      <div className="w-12 shrink-0 px-2 flex items-center justify-center border-r border-border bg-muted/20 text-xs text-muted-foreground">
        {rowIndex + 1}
      </div>

      {/* Status indicator */}
      <div className="w-10 shrink-0 px-2 flex items-center justify-center border-r border-border bg-muted/10">
        {isComplete ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : (
          <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
        )}
      </div>

      {/* Company name */}
      <div className="w-[160px] shrink-0 px-2 flex items-center border-r border-border font-medium">
        <CompanyLogo website={meta?.website ?? null} size={16} />
        <span className="truncate ml-2">{companyName}</span>
      </div>

      {/* Website */}
      <div className="w-[160px] shrink-0 px-2 flex items-center border-r border-border">
        <Cell
          value={meta?.website ?? null}
          isLoading={!meta?.website}
          isLink={!!meta?.website}
          sourceUrl={meta?.sources?.website}
        />
      </div>

      {/* Description */}
      <div className="w-[300px] shrink-0 px-2 flex items-center border-r border-border overflow-hidden">
        <Cell
          value={meta?.description ?? null}
          isLoading={!meta?.description}
          sourceUrl={meta?.sources?.description}
        />
      </div>

      {/* Industry */}
      <div className="w-[120px] shrink-0 px-2 flex items-center border-r border-border overflow-hidden">
        <Cell value={meta?.industry ?? null} isLoading={!meta?.industry} />
      </div>

      {/* Employees */}
      <div className="w-[90px] shrink-0 px-2 flex items-center border-r border-border">
        <Cell
          value={meta?.employeeCount ?? null}
          isLoading={!meta?.employeeCount}
          sourceUrl={meta?.sources?.employee_count}
          linkStyle="underline"
        />
      </div>

      {/* Stage */}
      <div className="w-[80px] shrink-0 px-2 flex items-center border-r border-border">
        <Cell
          value={meta?.stage ?? null}
          isLoading={!meta?.stage}
          sourceUrl={meta?.sources?.funding}
          linkStyle="underline"
        />
      </div>

      {/* Last Round */}
      <div className="w-[100px] shrink-0 px-2 flex items-center border-r border-border">
        <Cell
          value={meta?.lastRoundAmount ?? null}
          isLoading={!meta?.lastRoundAmount}
          sourceUrl={meta?.sources?.funding}
          linkStyle="underline"
        />
      </div>
    </div>
  );
}
