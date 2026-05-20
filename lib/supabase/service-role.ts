import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "./env";

/** Server-only Supabase client with service role (bypasses RLS). Never import from Client Components. */
export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
