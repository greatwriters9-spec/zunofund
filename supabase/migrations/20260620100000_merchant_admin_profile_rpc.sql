-- Merchant marketplace display name (shown on offers) + admin merchant directory helpers.

CREATE OR REPLACE FUNCTION public.merchant_update_display_name(p_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchant_profiles mp
    WHERE mp.user_id = auth.uid()
      AND mp.status IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.merchant_profiles mp
  SET
    display_name = NULLIF(trim(coalesce(p_display_name, '')), ''),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_update_display_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_update_display_name(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_merchant_profiles()
RETURNS TABLE (
  user_id uuid,
  investor_email text,
  display_name text,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    mp.user_id,
    coalesce(i.email::text, ''),
    mp.display_name,
    mp.status,
    mp.applied_at,
    mp.reviewed_at
  FROM public.merchant_profiles mp
  LEFT JOIN public.investors i ON i.user_id = mp.user_id
  ORDER BY mp.applied_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_merchant_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_merchant_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_merchant_access(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  UPDATE public.merchant_offers o
  SET
    status = 'inactive',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE o.merchant_user_id = p_target_user_id;

  UPDATE public.merchant_profiles mp
  SET
    status = 'suspended',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = p_target_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'no merchant profile for that user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_merchant_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_merchant_access(uuid) TO authenticated;
