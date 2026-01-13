import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import type { enrichCompany } from "@/trigger/enrich-company";

export const dynamic = "force-dynamic";

// Hardcoded dev user ID - replace with real auth later
const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();

  // Option 1: Enrich a new company by name (no ID yet)
  if (body.companyName && typeof body.companyName === "string") {
    const handle = await tasks.trigger<typeof enrichCompany>("enrich-company", {
      companyName: body.companyName.trim(),
      companyUrl: body.companyUrl ?? null,
      userId: DEV_USER_ID,
    });

    return NextResponse.json({
      runId: handle.id,
      accessToken: handle.publicAccessToken,
    });
  }

  // Option 2: Re-enrich existing companies by IDs
  const { companyIds } = body as { companyIds?: string[] };

  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json(
      { error: "Either companyName or companyIds array is required" },
      { status: 400 }
    );
  }

  // Fetch companies (service client bypasses RLS)
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, user_id")
    .in("id", companyIds);

  const found = companies ?? [];

  // Trigger enrichment for each company found
  const handles = await Promise.all(
    found.map((company) =>
      tasks.trigger<typeof enrichCompany>("enrich-company", {
        companyId: company.id,
        companyName: company.name,
        userId: company.user_id,
      })
    )
  );

  return NextResponse.json({
    triggered: handles.length,
    companyIds: found.map((c) => c.id),
  });
}
