import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Server Components / Server Actions: request-scoped Supabase with cookie session.
 * Session refresh is handled in `proxy.ts`; if cookies cannot be set here, that is expected.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Components cannot always set cookies — proxy handles refresh */
        }
      },
    },
  });
}
