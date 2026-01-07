import { task, metadata, batch } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getBasicInfo } from "./get-basic-info";
import { getIndustry } from "./get-industry";
import { getEmployeeCount } from "./get-employee-count";
import { getFundingRound } from "./get-funding-round";

// Metadata shape for realtime updates
export type EnrichmentMetadata = {
  companyName: string;
  status: "enriching" | "complete" | "error";
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  stage?: string | null;
  lastRoundAmount?: string | null;
  sources?: Record<string, string>;
  errors?: Record<string, string>;
};

export const enrichCompany = task({
  id: "enrich-company",
  retry: { maxAttempts: 1 },
  run: async ({
    companyId,
    companyName,
    userId,
  }: {
    companyId?: string;
    companyName: string;
    userId: string;
  }) => {
    const supabase = createServiceClient();
    const errors: Record<string, string> = {};

    // Initialize metadata for realtime
    metadata.set("companyName", companyName);
    metadata.set("status", "enriching");
    await metadata.flush();

    // Run all tasks in parallel using batch
    const { runs } = await batch.triggerByTaskAndWait([
      { task: getBasicInfo, payload: { companyName } },
      { task: getIndustry, payload: { companyName } },
      { task: getEmployeeCount, payload: { companyName } },
      { task: getFundingRound, payload: { companyName } },
    ]);

    const [basicInfoRun, industryRun, employeeRun, fundingRun] = runs;

    // Extract results and update metadata
    let website: string | null = null;
    let description: string | null = null;
    let industry: string | null = null;
    let employeeCount: string | null = null;
    let stage: string | null = null;
    let lastRoundAmount: string | null = null;

    // Collect source URLs
    const sources: Record<string, string> = {};

    if (basicInfoRun.ok && basicInfoRun.output) {
      website = basicInfoRun.output.website;
      description = basicInfoRun.output.description;
      if (basicInfoRun.output.sourceUrl) {
        sources.website = basicInfoRun.output.sourceUrl;
        sources.description = basicInfoRun.output.sourceUrl;
      }
      metadata.set("website", website);
      metadata.set("description", description);
    } else {
      errors["get-basic-info"] = "Failed to get basic info";
    }

    if (industryRun.ok && industryRun.output) {
      industry = industryRun.output.industry;
      metadata.set("industry", industry);
    } else {
      errors["get-industry"] = "Failed to get industry";
    }

    if (employeeRun.ok && employeeRun.output) {
      employeeCount = employeeRun.output.employeeCount;
      if (employeeRun.output.sourceUrl) {
        sources.employee_count = employeeRun.output.sourceUrl;
      }
      metadata.set("employeeCount", employeeCount);
    } else {
      errors["get-employee-count"] = "Failed to get employee count";
    }

    if (fundingRun.ok && fundingRun.output) {
      stage = fundingRun.output.stage;
      lastRoundAmount = fundingRun.output.lastRoundAmount;
      if (fundingRun.output.sourceUrl) {
        sources.funding = fundingRun.output.sourceUrl;
      }
      metadata.set("stage", stage);
      metadata.set("lastRoundAmount", lastRoundAmount);
    } else {
      errors["get-funding-round"] = "Failed to get funding";
    }

    // Set sources metadata for realtime streaming
    if (Object.keys(sources).length > 0) {
      metadata.set("sources", sources);
    }

    const hasErrors = Object.keys(errors).length > 0;
    metadata.set("status", hasErrors ? "error" : "complete");
    if (hasErrors) {
      metadata.set("errors", errors);
    }

    // Build company data for DB
    const companyData = {
      name: companyName,
      website,
      description,
      industry,
      employee_count: employeeCount,
      stage,
      last_round_amount: lastRoundAmount,
      sources,
    };

    const now = new Date().toISOString();

    // Persist to database
    if (companyId) {
      await supabase
        .from("companies")
        .update({
          ...companyData,
          enrichment_status: hasErrors ? "error" : "complete",
          enrichment_completed_at: now,
          errors: hasErrors ? errors : {},
        })
        .eq("id", companyId);
    } else {
      const { data } = await supabase
        .from("companies")
        .insert({
          user_id: userId,
          ...companyData,
          enrichment_status: hasErrors ? "error" : "complete",
          enrichment_started_at: now,
          enrichment_completed_at: now,
          errors: hasErrors ? errors : {},
        })
        .select("id")
        .single();

      if (data) {
        companyId = data.id;
      }
    }

    return {
      companyId,
      companyName,
      success: !hasErrors,
      errors,
      data: companyData,
    };
  },
});
