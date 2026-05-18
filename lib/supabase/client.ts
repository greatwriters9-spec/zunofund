import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Implicit flow for email/magic links so confirmation works when the user opens
 * the email on another device/browser than where they signed up (PKCE needs a
 * local code_verifier; without it, exchange fails while the email still verifies).
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
    },
  });
}
