"use client";

import { useState, useCallback, useRef } from "react";
import { Cell } from "./cell";
import { EnrichingRow } from "./enriching-row";
import type { Company } from "@/lib/supabase/types";
import { LucideWandSparkles } from "lucide-react";

const EMPTY_ROWS = 10;

interface EnrichingDraft {
  rowIndex: number;
  companyName: string;
  runId: string;
  accessToken: string;
}

interface SpreadsheetProps {
  initialCompanies: Company[];
}

export function Spreadsheet({ initialCompanies }: SpreadsheetProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [newCompanyName, setNewCompanyName] = useState<Record<number, string>>(
    {}
  );
  const [enrichingDrafts, setEnrichingDrafts] = useState<EnrichingDraft[]>([]);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Enrich a new company
  const handleEnrichDraft = useCallback(
    async (rowIndex: number) => {
      const name = newCompanyName[rowIndex]?.trim();
      if (!name) return;

      // Check if already enriching this row
      if (enrichingDrafts.some((d) => d.rowIndex === rowIndex)) return;

      try {
        const res = await fetch("/api/companies/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: name }),
        });

        if (!res.ok) throw new Error("Failed to trigger");

        const { runId, accessToken } = await res.json();

        // Add to enriching drafts with per-run accessToken
        setEnrichingDrafts((prev) => [
          ...prev,
          { rowIndex, companyName: name, runId, accessToken },
        ]);

        // Clear the input
        setNewCompanyName((prev) => {
          const next = { ...prev };
          delete next[rowIndex];
          return next;
        });
      } catch (err) {
        console.error("Enrich failed:", err);
      }
    },
    [newCompanyName, enrichingDrafts]
  );

  // Handle enrichment complete - add to companies, remove from drafts
  const handleEnrichComplete = useCallback(
    (
      runId: string,
      data: {
        companyName: string;
        website: string | null;
        description: string | null;
        industry: string | null;
        employeeCount: string | null;
        stage: string | null;
        lastRoundAmount: string | null;
        sources: Record<string, string>;
      }
    ) => {
      // Add as a company (DB persistence already happened in task)
      const newCompany: Company = {
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_id: "",
        name: data.companyName,
        website: data.website,
        description: data.description,
        industry: data.industry,
        employee_count: data.employeeCount,
        stage: data.stage,
        last_round_amount: data.lastRoundAmount,
        sources: data.sources,
        enrichment_status: "complete",
        enrichment_started_at: null,
        enrichment_completed_at: new Date().toISOString(),
        errors: {},
      };

      setCompanies((prev) => [...prev, newCompany]);
      setEnrichingDrafts((prev) => prev.filter((d) => d.runId !== runId));
    },
    []
  );

  // Re-enrich existing company
  const handleEnrichRow = useCallback(async (company: Company) => {
    await fetch("/api/companies/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyIds: [company.id] }),
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEnrichDraft(rowIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      inputRefs.current[rowIndex + 1]?.focus();
    } else if (e.key === "ArrowUp" && rowIndex > companies.length) {
      e.preventDefault();
      inputRefs.current[rowIndex - 1]?.focus();
    }
  };

  const isEnriching = (company: Company) =>
    company.enrichment_status === "pending" ||
    company.enrichment_status === "enriching";

  const getError = (company: Company, field: string) =>
    (company.errors as Record<string, string> | null)?.[field];

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
        <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/30 text-center">
          #
        </div>
        <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/30 text-center flex items-center justify-center">
          <LucideWandSparkles className="h-3 w-3 text-gray-400" />
        </div>
        <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
          Company
        </div>
        <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
          Website
        </div>
        <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border">
          Description
        </div>
        <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border">
          Industry
        </div>
        <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
          Employees
        </div>
        <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
          Stage
        </div>
        <div className="w-[120px] shrink-0 px-3 py-2">Last Round</div>
      </div>

      {/* Data rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {companies.map((company, index) => (
          <div
            key={company.id}
            className="flex border-b border-border hover:bg-muted/5 text-sm"
          >
            <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/20 text-center text-xs text-muted-foreground">
              {index + 1}
            </div>

            <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/10 flex items-center justify-center pointer-events-none">
              <button
                onClick={() => handleEnrichRow(company)}
                disabled={isEnriching(company)}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50 hover:cursor-pointer"
                title="Enrich with AI"
              >
                <LucideWandSparkles className="h-3 w-3 text-blue-400" />
              </button>
            </div>

            <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border font-medium">
              {company.name}
            </div>

            <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.website}
                isLoading={isEnriching(company) && !company.website}
                isLink={!!company.website}
                sourceUrl={company.sources?.website}
              />
            </div>

            <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border">
              <Cell
                value={company.description}
                isLoading={isEnriching(company) && !company.description}
                error={getError(company, "get-basic-info")}
                sourceUrl={company.sources?.description}
              />
            </div>

            <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.industry}
                isLoading={isEnriching(company) && !company.industry}
                error={getError(company, "get-industry")}
              />
            </div>

            <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.employee_count}
                isLoading={isEnriching(company) && !company.employee_count}
                error={getError(company, "get-employee-count")}
                sourceUrl={company.sources?.employee_count}
              />
            </div>

            <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.stage}
                isLoading={isEnriching(company) && !company.stage}
                error={getError(company, "get-funding-round")}
                sourceUrl={company.sources?.funding}
              />
            </div>

            <div className="w-[120px] shrink-0 px-3 py-2">
              <Cell
                value={company.last_round_amount}
                isLoading={isEnriching(company) && !company.last_round_amount}
                error={getError(company, "get-funding-round")}
                sourceUrl={company.sources?.funding}
              />
            </div>
          </div>
        ))}

        {/* Enriching draft rows - with realtime updates */}
        {enrichingDrafts.map((draft) => (
          <EnrichingRow
            key={draft.runId}
            rowIndex={companies.length + enrichingDrafts.indexOf(draft)}
            companyName={draft.companyName}
            runId={draft.runId}
            accessToken={draft.accessToken}
            onComplete={(data) => handleEnrichComplete(draft.runId, data)}
          />
        ))}

        {/* Empty input rows */}
        {Array.from({ length: EMPTY_ROWS }).map((_, i) => {
          const rowIndex = companies.length + enrichingDrafts.length + i;
          const hasText = !!newCompanyName[rowIndex]?.trim();

          return (
            <div
              key={`empty-${rowIndex}`}
              className="flex border-b border-border hover:bg-muted/5 text-sm"
            >
              <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/20 text-center text-xs text-muted-foreground">
                {rowIndex + 1}
              </div>

              <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/10 flex items-center justify-center">
                {hasText && (
                  <button
                    onClick={() => handleEnrichDraft(rowIndex)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Enrich with AI"
                  >
                    <LucideWandSparkles className="h-3 w-3 text-blue-400" />
                  </button>
                )}
              </div>

              <div className="w-[180px] shrink-0 border-r border-border">
                <input
                  ref={(el) => {
                    inputRefs.current[rowIndex] = el;
                  }}
                  type="text"
                  value={newCompanyName[rowIndex] ?? ""}
                  onChange={(e) =>
                    setNewCompanyName((prev) => ({
                      ...prev,
                      [rowIndex]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => handleKeyDown(e, rowIndex)}
                  placeholder={i === 0 ? "Enter company..." : ""}
                  className="w-full h-full px-3 py-2 bg-transparent outline-none focus:bg-blue-500/5 placeholder:text-muted-foreground/30 text-sm"
                />
              </div>

              <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[120px] shrink-0 px-3 py-2 text-muted-foreground/20">
                —
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
