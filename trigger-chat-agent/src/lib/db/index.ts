import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Optional database. With no DATABASE_URL the whole persistence layer is off:
 * chats aren't saved, the sidebar is hidden, and the app behaves exactly as it
 * does without a database. Set it and history appears. (Same shape as the
 * REDIS_URL gate in Vercel's ai-chatbot.)
 *
 * The client is created once at module scope so a worker process reuses one
 * pool across runs, with `max: 1` per Trigger.dev's connection guidance —
 * concurrent runs multiply the pool, so a big pool per run exhausts the
 * provider's connection limit. Attach an error handler: an idle connection can
 * error asynchronously, and an unhandled 'error' event takes the worker down.
 *
 * Use the Supabase transaction-mode (pooler, :6543) URL here. node-postgres
 * doesn't use prepared statements by default, which that pooler doesn't
 * support — that's why this uses `pg` rather than postgres.js.
 */

export const isPersistenceEnabled = Boolean(process.env.DATABASE_URL);

function createDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  pool.on("error", (err) => console.error("pg pool error", err));
  return drizzle({ client: pool, schema });
}

let cached: ReturnType<typeof createDb> | undefined;

/** The Drizzle client, or null when no DATABASE_URL is configured. */
export function getDb() {
  if (!isPersistenceEnabled) return null;
  return (cached ??= createDb());
}

export { schema };
