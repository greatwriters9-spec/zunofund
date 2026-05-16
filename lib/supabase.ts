// Client-safe entry only. Server Components must import createServerSupabaseClient from
// `@/lib/supabase/server` so `next/headers` is never bundled into Client Components.
export { createBrowserClient } from "./supabase/client";
export { useSupabase } from "./supabase/hooks";
export { formatSupabaseError } from "./supabase/error";
export { coerceRpcBigint } from "./supabase/rpcScalars";
