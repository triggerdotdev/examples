import { NextResponse } from "next/server";
import { auth } from "@trigger.dev/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const triggerToken = await auth.createTriggerPublicToken("enrich-company");

  return NextResponse.json({ token: triggerToken });
}
