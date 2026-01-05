import { task, batch } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getBasicInfo } from "./get-basic-info";
import { getIndustry } from "./get-industry";
import { getEmployeeCount } from "./get-employee-count";
import { getFunding } from "./get-funding";

export const enrichCompany = task({
  id: "enrich-company",
  retry: { maxAttempts: 1 },
  run: async ({
    companyId,
    companyName,
    userId,
  }: {
    companyId?: string; // Optional - if provided, UPDATE existing row
    companyName: string;
    userId: string; // Required for new companies
  }) => {
    const supabase = createServiceClient();

    // Run all enrichment tasks in parallel
    const { runs } = await batch.triggerByTaskAndWait([
      { task: getBasicInfo, payload: { companyName } },
      { task: getIndustry, payload: { companyName } },
      { task: getEmployeeCount, payload: { companyName } },
      { task: getFunding, payload: { companyName } },
    ]);

    // Collect results and errors
    const [basicInfoRun, industryRun, employeeRun, fundingRun] = runs;
    const errors: Record<string, string> = {};

    // Extract data from successful runs
    const companyData: Record<string, string | null> = {
      name: companyName,
      website: null,
      description: null,
      industry: null,
      employee_count: null,
      amount_raised: null,
    };

    if (basicInfoRun.ok) {
      companyData.website = basicInfoRun.output.website;
      companyData.description = basicInfoRun.output.description;
    } else {
      errors["get-basic-info"] = typeof basicInfoRun.error === "string"
        ? basicInfoRun.error
        : "Failed to get basic info";
    }

    if (industryRun.ok) {
      companyData.industry = industryRun.output.industry;
    } else {
      errors["get-industry"] = typeof industryRun.error === "string"
        ? industryRun.error
        : "Failed to get industry";
    }

    if (employeeRun.ok) {
      companyData.employee_count = employeeRun.output.employeeCount;
    } else {
      errors["get-employee-count"] = typeof employeeRun.error === "string"
        ? employeeRun.error
        : "Failed to get employee count";
    }

    if (fundingRun.ok) {
      companyData.amount_raised = fundingRun.output.amountRaised;
    } else {
      errors["get-funding"] = typeof fundingRun.error === "string"
        ? fundingRun.error
        : "Failed to get funding";
    }

    const hasErrors = Object.keys(errors).length > 0;
    const now = new Date().toISOString();

    // Save to database - INSERT new or UPDATE existing
    if (companyId) {
      // Update existing company
      await supabase
        .from("companies")
        .update({
          name: companyName,
          website: companyData.website,
          description: companyData.description,
          industry: companyData.industry,
          employee_count: companyData.employee_count,
          amount_raised: companyData.amount_raised,
          enrichment_status: hasErrors ? "error" : "complete",
          enrichment_completed_at: now,
          errors: hasErrors ? errors : {},
        })
        .eq("id", companyId);
    } else {
      // Insert new company with all enriched data
      const { data } = await supabase
        .from("companies")
        .insert({
          user_id: userId,
          name: companyName,
          website: companyData.website,
          description: companyData.description,
          industry: companyData.industry,
          employee_count: companyData.employee_count,
          amount_raised: companyData.amount_raised,
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
