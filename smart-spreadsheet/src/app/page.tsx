import { NavBar } from "@/components/nav-bar";
import { Toolbar } from "@/components/toolbar";
import { Spreadsheet } from "@/components/spreadsheet";
import { createServiceClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/supabase/types";

export default async function Home() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true });

  const initialCompanies = (data as Company[]) ?? [];

  return (
    <main className="min-h-screen flex flex-col">
      <NavBar />
      <Toolbar />
      <div className="flex-1 overflow-hidden">
        <Spreadsheet initialCompanies={initialCompanies} />
      </div>
    </main>
  );
}
