-- Tighten PostgREST exposure: SECURITY DEFINER jobs only for service_role;
-- admin investor RPCs for authenticated only; trigger helper not RPC-callable.

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_daily_compound_interest() TO service_role;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mature_principal_locks(timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.run_daily_investment_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_investment_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.withdrawals_before_insert_validate() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
