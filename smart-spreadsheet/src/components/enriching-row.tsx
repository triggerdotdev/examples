"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Cell } from "./cell";
import { Loader2, CheckCircle } from "lucide-react";
import type { enrichCompany, EnrichmentMetadata } from "@/trigger/enrich-company";

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
    amountRaised: string | null;
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
        onComplete({
          companyName,
          website: completedRun.output.data.website,
          description: completedRun.output.data.description,
          industry: completedRun.output.data.industry,
          employeeCount: completedRun.output.data.employee_count,
          amountRaised: completedRun.output.data.amount_raised,
        });
      }
    },
  });

  const meta = run?.metadata as EnrichmentMetadata | undefined;
  const isComplete = run?.status === "COMPLETED";

  return (
    <div className="flex border-b border-border hover:bg-muted/5 text-sm">
      {/* Row number */}
      <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/20 text-center text-xs text-muted-foreground">
        {rowIndex + 1}
      </div>

      {/* Status indicator */}
      <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/10 flex items-center justify-center">
        {isComplete ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : (
          <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
        )}
      </div>

      {/* Company name */}
      <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border font-medium">
        {companyName}
      </div>

      {/* Website */}
      <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
        <Cell
          value={meta?.website ?? null}
          isLoading={!meta?.website}
          isLink={!!meta?.website}
        />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border">
        <Cell value={meta?.description ?? null} isLoading={!meta?.description} />
      </div>

      {/* Industry */}
      <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border">
        <Cell value={meta?.industry ?? null} isLoading={!meta?.industry} />
      </div>

      {/* Employees */}
      <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
        <Cell
          value={meta?.employeeCount ?? null}
          isLoading={!meta?.employeeCount}
        />
      </div>

      {/* Raised */}
      <div className="w-[120px] shrink-0 px-3 py-2">
        <Cell value={meta?.amountRaised ?? null} isLoading={!meta?.amountRaised} />
      </div>
    </div>
  );
}
