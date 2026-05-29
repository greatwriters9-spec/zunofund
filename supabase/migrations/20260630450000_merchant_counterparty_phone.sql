-- Expose investor phone to admins (direct RLS) and merchants (counterparty RPCs on shared trades).

DROP FUNCTION IF EXISTS public.merchant_list_counterparty_profiles(uuid[]);

CREATE OR REPLACE FUNCTION public.merchant_list_counterparty_profiles(p_investor_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT DISTINCT
    i.user_id AS user_id,
    NULLIF(trim(i.email::text), '') AS email,
    NULLIF(trim(coalesce(i.full_name::text, '')), '') AS full_name,
    NULLIF(trim(coalesce(i.phone::text, '')), '') AS phone
  FROM public.investors AS i
  WHERE
    auth.uid() IS NOT NULL
    AND public.is_active_merchant(auth.uid())
    AND i.user_id = ANY (coalesce(p_investor_user_ids, '{}'::uuid[]))
    AND EXISTS (
      SELECT 1
      FROM public.merchant_orders AS mo
      WHERE mo.merchant_user_id = auth.uid()
        AND mo.investor_user_id = i.user_id
    );
$$;

REVOKE ALL ON FUNCTION public.merchant_list_counterparty_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_list_counterparty_profiles(uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.merchant_get_order_investor_presence(uuid);

CREATE OR REPLACE FUNCTION public.merchant_get_order_investor_presence(p_order_id uuid)
RETURNS TABLE (
  is_online boolean,
  last_seen_at timestamptz,
  full_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    i.is_online,
    i.last_seen_at,
    NULLIF(trim(coalesce(i.full_name::text, '')), '') AS full_name,
    NULLIF(trim(i.email::text), '') AS email,
    NULLIF(trim(coalesce(i.phone::text, '')), '') AS phone
  FROM public.merchant_orders AS mo
  INNER JOIN public.investors AS i ON i.user_id = mo.investor_user_id
  WHERE mo.id = p_order_id
    AND mo.merchant_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.merchant_get_order_investor_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_get_order_investor_presence(uuid) TO authenticated;
