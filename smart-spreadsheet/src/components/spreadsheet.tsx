"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Cell } from "./cell";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/lib/supabase/types";
import { Play, Loader2 } from "lucide-react";

const EMPTY_ROWS = 20;

interface SpreadsheetProps {
  initialCompanies: Company[];
}

export function Spreadsheet({ initialCompanies }: SpreadsheetProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [newCompanyName, setNewCompanyName] = useState<Record<number, string>>({});
  const [enrichingDrafts, setEnrichingDrafts] = useState<Set<number>>(new Set());
  const [draftErrors, setDraftErrors] = useState<Record<number, string>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const pendingCompanyNames = useRef<Set<string>>(new Set());

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Supabase realtime - valid useEffect for external system
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("companies-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newCompany = payload.new as Company;
            setCompanies((prev) => [...prev, newCompany]);

            // Clear draft if this was a pending enrichment
            if (pendingCompanyNames.current.has(newCompany.name)) {
              pendingCompanyNames.current.delete(newCompany.name);
              // Find and clear the draft row with this name
              setNewCompanyName((prev) => {
                const next = { ...prev };
                for (const [key, value] of Object.entries(next)) {
                  if (value.trim() === newCompany.name) {
                    delete next[Number(key)];
                    break;
                  }
                }
                return next;
              });
              // Clear enriching state for that row
              setEnrichingDrafts((prev) => {
                const next = new Set(prev);
                // Remove all - the draft is gone now anyway
                return next;
              });
            }
          } else if (payload.eventType === "UPDATE") {
            setCompanies((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Company).id
                  ? (payload.new as Company)
                  : c
              )
            );
          } else if (payload.eventType === "DELETE") {
            setCompanies((prev) =>
              prev.filter((c) => c.id !== (payload.old as Company).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Enrich a draft row (triggers enrichment, saves to DB when complete)
  const handleEnrichDraft = useCallback(
    async (rowIndex: number) => {
      const name = newCompanyName[rowIndex]?.trim();
      if (!name || enrichingDrafts.has(rowIndex)) return;

      // Mark as enriching
      setEnrichingDrafts((prev) => new Set(prev).add(rowIndex));
      setDraftErrors((prev) => {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      });

      // Track this company name so we can clear draft when it appears
      pendingCompanyNames.current.add(name);

      try {
        const res = await fetch("/api/companies/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: name }),
        });

        if (!res.ok) {
          throw new Error("Failed to trigger enrichment");
        }
        // Don't clear draft here - wait for Supabase realtime INSERT
      } catch (err) {
        // Show error, allow retry
        pendingCompanyNames.current.delete(name);
        setDraftErrors((prev) => ({
          ...prev,
          [rowIndex]: err instanceof Error ? err.message : "Enrichment failed",
        }));
        setEnrichingDrafts((prev) => {
          const next = new Set(prev);
          next.delete(rowIndex);
          return next;
        });
      }
    },
    [newCompanyName, enrichingDrafts]
  );

  // Update field in DB
  const handleFieldUpdate = useCallback(
    async (companyId: string, field: string, value: string) => {
      // Optimistic update
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId ? { ...c, [field]: value || null } : c
        )
      );
      // Persist (skip if supabase not configured)
      if (supabase) {
        await supabase
          .from("companies")
          .update({ [field]: value || null })
          .eq("id", companyId);
      }
    },
    [supabase]
  );

  // Trigger enrichment for a row
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

  // Derived: check if enriching
  const isEnriching = (company: Company) =>
    company.enrichment_status === "pending" ||
    company.enrichment_status === "enriching";

  const getError = (company: Company, field: string) =>
    (company.errors as Record<string, string> | null)?.[field];

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
        <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/30 text-center">#</div>
        <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/30 text-center">▶</div>
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
        <div className="w-[120px] shrink-0 px-3 py-2">Raised</div>
      </div>

      {/* Data rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {companies.map((company, index) => (
          <div
            key={company.id}
            className="flex border-b border-border hover:bg-muted/5 text-sm"
          >
            {/* Row number */}
            <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/20 text-center text-xs text-muted-foreground">
              {index + 1}
            </div>

            {/* Enrich button */}
            <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/10 flex items-center justify-center">
              <button
                onClick={() => handleEnrichRow(company)}
                disabled={isEnriching(company)}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                title="Enrich with AI"
              >
                <Play className="h-3 w-3 text-blue-400" />
              </button>
            </div>

            {/* Company name - editable */}
            <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
              <input
                type="text"
                defaultValue={company.name}
                onBlur={(e) => {
                  if (e.target.value !== company.name) {
                    handleFieldUpdate(company.id, "name", e.target.value);
                  }
                }}
                className="w-full bg-transparent outline-none focus:bg-blue-500/5 rounded px-1 -mx-1"
              />
            </div>

            {/* Website - editable */}
            <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border">
              {isEnriching(company) && !company.website ? (
                <Cell value={null} isLoading taskName="getBasicInfo" />
              ) : (
                <input
                  type="text"
                  defaultValue={company.website ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (company.website ?? "")) {
                      handleFieldUpdate(company.id, "website", e.target.value);
                    }
                  }}
                  placeholder="—"
                  className="w-full bg-transparent outline-none focus:bg-blue-500/5 rounded px-1 -mx-1 placeholder:text-muted-foreground/50"
                />
              )}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border">
              <Cell
                value={company.description}
                isLoading={isEnriching(company) && !company.description}
                taskName="getBasicInfo"
                error={getError(company, "get-basic-info")}
              />
            </div>

            {/* Industry */}
            <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.industry}
                isLoading={isEnriching(company) && !company.industry}
                taskName="getIndustry"
                error={getError(company, "get-industry")}
              />
            </div>

            {/* Employees */}
            <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border">
              <Cell
                value={company.employee_count}
                isLoading={isEnriching(company) && !company.employee_count}
                taskName="getEmployeeCount"
                error={getError(company, "get-employee-count")}
              />
            </div>

            {/* Raised */}
            <div className="w-[120px] shrink-0 px-3 py-2">
              <Cell
                value={company.amount_raised}
                isLoading={isEnriching(company) && !company.amount_raised}
                taskName="getFunding"
                error={getError(company, "get-funding")}
              />
            </div>
          </div>
        ))}

        {/* Empty input rows */}
        {Array.from({ length: EMPTY_ROWS }).map((_, i) => {
          const rowIndex = companies.length + i;
          const isEnrichingDraft = enrichingDrafts.has(rowIndex);
          const hasText = !!newCompanyName[rowIndex]?.trim();
          const error = draftErrors[rowIndex];

          return (
            <div
              key={`empty-${rowIndex}`}
              className="flex border-b border-border hover:bg-muted/5 text-sm"
            >
              <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/20 text-center text-xs text-muted-foreground">
                {rowIndex + 1}
              </div>
              {/* Play button - show when has text */}
              <div className="w-10 shrink-0 px-2 py-2 border-r border-border bg-muted/10 flex items-center justify-center">
                {hasText && (
                  <button
                    onClick={() => handleEnrichDraft(rowIndex)}
                    disabled={isEnrichingDraft}
                    className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                    title="Enrich with AI"
                  >
                    {isEnrichingDraft ? (
                      <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 text-blue-400" />
                    )}
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
                  placeholder={
                    rowIndex === companies.length ? "Enter company..." : ""
                  }
                  disabled={isEnrichingDraft}
                  className="w-full h-full px-3 py-2 bg-transparent outline-none focus:bg-blue-500/5 placeholder:text-muted-foreground/30 text-sm text-foreground disabled:opacity-50"
                />
              </div>
              <div className="w-[180px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                {isEnrichingDraft ? <Cell value={null} isLoading taskName="enriching" /> : "—"}
              </div>
              <div className="flex-1 min-w-[250px] px-3 py-2 border-r border-border text-muted-foreground/20">
                {isEnrichingDraft ? <Cell value={null} isLoading taskName="enriching" /> : error ? (
                  <span className="text-destructive text-xs">{error}</span>
                ) : "—"}
              </div>
              <div className="w-[140px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                {isEnrichingDraft ? <Cell value={null} isLoading taskName="enriching" /> : "—"}
              </div>
              <div className="w-[100px] shrink-0 px-3 py-2 border-r border-border text-muted-foreground/20">
                {isEnrichingDraft ? <Cell value={null} isLoading taskName="enriching" /> : "—"}
              </div>
              <div className="w-[120px] shrink-0 px-3 py-2 text-muted-foreground/20">
                {isEnrichingDraft ? <Cell value={null} isLoading taskName="enriching" /> : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
