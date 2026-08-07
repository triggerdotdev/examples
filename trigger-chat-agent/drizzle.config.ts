import { defineConfig } from "drizzle-kit";

// Migrations run from your machine, never from the deployed worker, so this
// uses its own connection string: MIGRATION_DATABASE_URL (Supabase session
// mode, :5432 on the pooler host) which supports DDL and works on IPv4
// networks. The app itself uses DATABASE_URL (transaction mode, :6543).
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
});
