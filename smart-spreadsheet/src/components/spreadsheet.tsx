"use client";

import { useState, useCallback, useRef } from "react";
import { Cell } from "./cell";
import { EnrichingRow } from "./enriching-row";
import type { Company } from "@/lib/supabase/types";
import { LucideWandSparkles, Trash2, WrapText, AlignLeft, Building2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EMPTY_ROWS = 25;

// Detect if input looks like a URL and extract domain
function parseInput(input: string): { name: string; url: string | null } {
  const trimmed = input.trim();

  // Check for URL patterns
  const urlPattern = /^(https?:\/\/)?([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}(\/.*)?$/i;
  if (urlPattern.test(trimmed)) {
    // Normalize URL
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    // Extract domain for display name
    const domain = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    // Convert domain to readable name (e.g., "stripe.com" -> "Stripe")
    const name = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
    return { name, url };
  }

  return { name: trimmed, url: null };
}

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
  const [wrapDescriptions, setWrapDescriptions] = useState(false);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Enrich a new company
  const handleEnrichDraft = useCallback(
    async (rowIndex: number) => {
      const input = newCompanyName[rowIndex]?.trim();
      if (!input) return;

      // Check if already enriching this row
      if (enrichingDrafts.some((d) => d.rowIndex === rowIndex)) return;

      // Parse input - could be company name or URL
      const { name, url } = parseInput(input);

      try {
        const res = await fetch("/api/companies/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: name, companyUrl: url }),
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

  // Delete company
  const handleDeleteRow = useCallback(async (company: Company) => {
    if (!window.confirm(`Delete "${company.name}"?`)) return;

    try {
      const res = await fetch("/api/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      setCompanies((prev) => prev.filter((c) => c.id !== company.id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - sticky */}
      <div className="flex bg-muted/40 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
        <div className="w-12 shrink-0 px-2 py-2 border-r border-border text-center">
          #
        </div>
        <div className="w-10 shrink-0 px-2 py-2 border-r border-border text-center flex items-center justify-center">
          <LucideWandSparkles className="h-3 w-3 text-muted-foreground/60" />
        </div>
        <div className="w-[160px] shrink-0 px-2 py-2 border-r border-border">
          Company
        </div>
        <div className="w-[160px] shrink-0 px-2 py-2 border-r border-border">
          Website
        </div>
        <div className="w-[300px] shrink-0 px-2 py-2 border-r border-border flex items-center justify-between">
          <span>Description</span>
          <button
            onClick={() => setWrapDescriptions(!wrapDescriptions)}
            className="p-0.5 rounded hover:bg-muted transition-colors"
            title={wrapDescriptions ? "Truncate descriptions" : "Wrap descriptions"}
          >
            {wrapDescriptions ? (
              <AlignLeft className="h-3 w-3" />
            ) : (
              <WrapText className="h-3 w-3" />
            )}
          </button>
        </div>
        <div className="w-[120px] shrink-0 px-2 py-2 border-r border-border">
          Industry
        </div>
        <div className="w-[90px] shrink-0 px-2 py-2 border-r border-border">
          Employees
        </div>
        <div className="w-[80px] shrink-0 px-2 py-2 border-r border-border">
          Stage
        </div>
        <div className="w-[100px] shrink-0 px-2 py-2">Last Round</div>
      </div>

      {/* Data rows - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {companies.map((company, index) => (
          <div
            key={company.id}
            className={`group flex border-b border-border hover:bg-blue-500/5 text-[13px] transition-all duration-200 ease-in-out ${
              wrapDescriptions ? "min-h-9" : "h-9"
            }`}
          >
            <div className={`w-12 shrink-0 px-2 flex justify-center border-r border-border bg-muted/20 text-xs text-muted-foreground ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              {index + 1}
            </div>

            <div className={`w-10 shrink-0 px-2 flex justify-center border-r border-border bg-muted/10 ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              {company.enrichment_status === "complete" ? (
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/60" />
              ) : (
                <button
                  onClick={() => handleEnrichRow(company)}
                  disabled={isEnriching(company)}
                  className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50 hover:cursor-pointer"
                  title="Enrich with AI"
                >
                  <LucideWandSparkles className="h-3 w-3 text-blue-400" />
                </button>
              )}
            </div>

            <div className={`w-[160px] shrink-0 px-2 flex border-r border-border font-medium relative ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <span className="truncate">{company.name}</span>
              <button
                onClick={() => handleDeleteRow(company)}
                className={`absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all ${
                  wrapDescriptions ? "top-2" : "top-1/2 -translate-y-1/2"
                }`}
                title="Delete company"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
              </button>
            </div>

            <div className={`w-[160px] shrink-0 px-2 flex border-r border-border overflow-hidden ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <Cell
                value={company.website}
                isLoading={isEnriching(company) && !company.website}
                isLink={!!company.website}
                sourceUrl={company.sources?.website}
              />
            </div>

            <div className={`w-[300px] shrink-0 px-2 flex border-r border-border overflow-hidden ${
              wrapDescriptions ? "py-2 items-start" : "items-center"
            }`}>
              {company.description ? (
                wrapDescriptions ? (
                  <span className="whitespace-pre-wrap break-words leading-relaxed">
                    {company.description}
                  </span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate cursor-default">
                        {company.description}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-md">
                      {company.description}
                    </TooltipContent>
                  </Tooltip>
                )
              ) : (
                <Cell
                  value={null}
                  isLoading={isEnriching(company) && !company.description}
                  error={getError(company, "get-basic-info")}
                />
              )}
            </div>

            <div className={`w-[120px] shrink-0 px-2 flex border-r border-border overflow-hidden ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <Cell
                value={company.industry}
                isLoading={isEnriching(company) && !company.industry}
                error={getError(company, "get-industry")}
              />
            </div>

            <div className={`w-[90px] shrink-0 px-2 flex border-r border-border ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <Cell
                value={company.employee_count}
                isLoading={isEnriching(company) && !company.employee_count}
                error={getError(company, "get-employee-count")}
                sourceUrl={company.sources?.employee_count}
                linkStyle="underline"
              />
            </div>

            <div className={`w-[80px] shrink-0 px-2 flex border-r border-border ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <Cell
                value={company.stage}
                isLoading={isEnriching(company) && !company.stage}
                error={getError(company, "get-funding-round")}
                sourceUrl={company.sources?.funding}
                linkStyle="underline"
              />
            </div>

            <div className={`w-[100px] shrink-0 px-2 flex ${
              wrapDescriptions ? "pt-2.5 items-start" : "items-center"
            }`}>
              <Cell
                value={company.last_round_amount}
                isLoading={isEnriching(company) && !company.last_round_amount}
                error={getError(company, "get-funding-round")}
                sourceUrl={company.sources?.funding}
                linkStyle="underline"
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
              className="flex border-b border-border hover:bg-muted/5 text-[13px] h-9"
            >
              <div className="w-12 shrink-0 px-2 flex items-center justify-center border-r border-border bg-muted/20 text-xs text-muted-foreground">
                {rowIndex + 1}
              </div>

              <div className="w-10 shrink-0 px-2 flex items-center justify-center border-r border-border bg-muted/10">
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

              <div className="w-[160px] shrink-0 border-r border-border">
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
                  className="w-full h-9 px-2 bg-transparent outline-none focus:bg-blue-500/5 placeholder:text-muted-foreground/40 text-[13px]"
                />
              </div>

              <div className="w-[160px] shrink-0 px-2 flex items-center border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[300px] shrink-0 px-2 flex items-center border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[120px] shrink-0 px-2 flex items-center border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[90px] shrink-0 px-2 flex items-center border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[80px] shrink-0 px-2 flex items-center border-r border-border text-muted-foreground/20">
                —
              </div>
              <div className="w-[100px] shrink-0 px-2 flex items-center text-muted-foreground/20">
                —
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
