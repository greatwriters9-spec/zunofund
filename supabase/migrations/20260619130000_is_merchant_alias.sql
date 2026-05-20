-- Plan-named helper: `is_merchant` delegates to existing `is_active_merchant`.

CREATE OR REPLACE FUNCTION public.is_merchant(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_merchant(check_uid);
$$;

REVOKE ALL ON FUNCTION public.is_merchant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_merchant(uuid) TO authenticated;
