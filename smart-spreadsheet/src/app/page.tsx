import { Spreadsheet } from "@/components/spreadsheet";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <main className="container mx-auto py-24 px-4">
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight pb-1">
            Smart Spreadsheet
          </h1>
          <p className="text-muted-foreground">
            Company enrichment powered by{" "}
            <a
              href="https://trigger.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Trigger.dev
            </a>{" "}
            background tasks.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <Spreadsheet initialCompanies={initialCompanies} />

      <footer className="mt-12 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Type a company name and press Enter. Watch cells populate in real-time
          as parallel Trigger.dev tasks complete.
        </p>
      </footer>
    </main>
  );
}
