import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// the only createClient in the codebase. nothing outside lib/store imports supabase-js
export function storeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
