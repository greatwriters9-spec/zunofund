-- Profile avatars on open P2P trades (investor ↔ merchant).

CREATE OR REPLACE FUNCTION public.investor_get_order_merchant_profile(p_order_id uuid)
RETURNS TABLE (
  display_name text,
  is_online boolean,
  last_seen_at timestamptz,
  presence_mode text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    mp.display_name,
    mp.is_online,
    mp.last_seen_at,
    mp.presence_mode,
    NULLIF(trim(inv.avatar_url::text), '') AS avatar_url
  FROM public.merchant_orders AS mo
  INNER JOIN public.merchant_profiles AS mp
    ON mp.user_id = mo.merchant_user_id AND mp.status = 'active'
  LEFT JOIN public.investors AS inv
    ON inv.user_id = mo.merchant_user_id
  WHERE mo.id = p_order_id
    AND mo.investor_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.investor_get_order_merchant_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_get_order_merchant_profile(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.merchant_get_order_investor_presence(uuid);

CREATE OR REPLACE FUNCTION public.merchant_get_order_investor_presence(p_order_id uuid)
RETURNS TABLE (
  is_online boolean,
  last_seen_at timestamptz,
  full_name text,
  email text,
  phone text,
  avatar_url text
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
    NULLIF(trim(coalesce(i.phone::text, '')), '') AS phone,
    NULLIF(trim(i.avatar_url::text), '') AS avatar_url
  FROM public.merchant_orders AS mo
  INNER JOIN public.investors AS i ON i.user_id = mo.investor_user_id
  WHERE mo.id = p_order_id
    AND mo.merchant_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.merchant_get_order_investor_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_get_order_investor_presence(uuid) TO authenticated;
