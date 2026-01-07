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
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Smart Spreadsheet
          </h1>
          <p className="text-xs text-muted-foreground">
            Company enrichment powered by{" "}
            <a
              href="https://trigger.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Trigger.dev
            </a>
            ,{" "}
            <a
              href="https://exa.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Exa
            </a>{" "}
            and{" "}
            <a
              href="https://anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Claude
            </a>
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Spreadsheet - takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <Spreadsheet initialCompanies={initialCompanies} />
      </div>
    </main>
  );
}
