import { createClient } from "@supabase/supabase-js";

// Simple browser-safe Supabase client for broadcasts
// NOTE: Clean up console.logs after debugging
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

console.log("[supabase.ts] Client initialized with URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);