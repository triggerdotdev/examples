import { task, metadata, batch } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getBasicInfo } from "./get-basic-info";
import { getIndustry } from "./get-industry";
import { getEmployeeCount } from "./get-employee-count";
import { getFunding } from "./get-funding";

// Metadata shape for realtime updates
export type EnrichmentMetadata = {
  companyName: string;
  status: "enriching" | "complete" | "error";
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  amountRaised?: string | null;
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
      { task: getFunding, payload: { companyName } },
    ]);

    const [basicInfoRun, industryRun, employeeRun, fundingRun] = runs;

    // Extract results and update metadata
    let website: string | null = null;
    let description: string | null = null;
    let industry: string | null = null;
    let employeeCount: string | null = null;
    let amountRaised: string | null = null;

    if (basicInfoRun.ok && basicInfoRun.output) {
      website = basicInfoRun.output.website;
      description = basicInfoRun.output.description;
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
      metadata.set("employeeCount", employeeCount);
    } else {
      errors["get-employee-count"] = "Failed to get employee count";
    }

    if (fundingRun.ok && fundingRun.output) {
      amountRaised = fundingRun.output.amountRaised;
      metadata.set("amountRaised", amountRaised);
    } else {
      errors["get-funding"] = "Failed to get funding";
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
      stage: null as string | null, // TODO: populate in US-004
      last_round_amount: amountRaised, // Renamed from amount_raised
      sources: {} as Record<string, string>, // TODO: populate in US-002,003,004
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
