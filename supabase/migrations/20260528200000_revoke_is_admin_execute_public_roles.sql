-- Pre-launch audit: reduce exposure of public.is_admin(uuid).
--
-- Desired end state: callers cannot invoke public.is_admin via PostgREST while RLS and triggers keep working.
--
-- Verification (PostgreSQL behavior):
-- • RLS policy predicates and SECURITY INVOKER routines run as the session role ("authenticated").
--   Any function call from those contexts requires EXECUTE on that function for "authenticated".
-- • SECURITY DEFINER bodies execute nested SQL with the definer's privileges; nested calls to
--   public.is_admin from definer-owned helpers do not, by themselves, justify revoking EXECUTE
--   from "authenticated" while policies still call public.is_admin(auth.uid()) directly.
-- • Several SECURITY INVOKER triggers/functions also reference public.is_admin(auth.uid()); revoking
--   EXECUTE from "authenticated" would break investor-facing updates until those bodies are refactored
--   (e.g. inline EXISTS against public.admins under existing admins RLS, or marked SECURITY DEFINER).
--
-- Action in this migration:
-- • REVOKE EXECUTE FROM anon — baseline never granted anon; harmless if anon lacks the grant.
-- • Do NOT revoke from authenticated here — requires a dedicated follow-up migration refactors all
--   predicate/trigger sites above, then: REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
