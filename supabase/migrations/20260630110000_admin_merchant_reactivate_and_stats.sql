CREATE OR REPLACE FUNCTION public.admin_reactivate_merchant(p_target_user_id uuid)
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

  UPDATE public.merchant_profiles mp
  SET
    status = 'active',
    reviewed_at = (NOW() AT TIME ZONE 'UTC'),
    reviewed_by = auth.uid(),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = p_target_user_id
    AND mp.status IN ('suspended', 'rejected');

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant must be suspended or rejected to reactivate';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reactivate_merchant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_merchant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._merchant_order_volume_usd(mo public.merchant_orders)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(
    CASE
      WHEN coalesce(mo.fiat_amount, 0) > 0 THEN
        CASE
          WHEN upper(trim(coalesce(mo.fiat_currency_code, 'USD'))) = 'USD' THEN mo.fiat_amount
          ELSE mo.fiat_amount * greatest(coalesce(mo.fx_rate_usd_at_open, 1), 0.0001)
        END
      ELSE coalesce(
        mo.usdt_escrow_amount,
        mo.usdt_credit_amount,
        public._p2p_btc_amount_to_usdt(mo.btc_escrow_amount),
        public._p2p_btc_amount_to_usdt(mo.btc_credit_amount),
        mo.amount_requested,
        0
      )
    END,
    4
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_merchant_stats()
RETURNS TABLE (
  user_id uuid,
  investor_email text,
  display_name text,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz,
  order_count bigint,
  completed_count bigint,
  total_volume_usd numeric
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
    mp.reviewed_at,
    count(mo.id)::bigint,
    count(mo.id) FILTER (WHERE mo.status = 'completed')::bigint,
    coalesce(
      sum(public._merchant_order_volume_usd(mo)) FILTER (WHERE mo.status IN ('completed', 'paid')),
      0
    )::numeric
  FROM public.merchant_profiles mp
  LEFT JOIN public.investors i ON i.user_id = mp.user_id
  LEFT JOIN public.merchant_orders mo ON mo.merchant_user_id = mp.user_id
  GROUP BY mp.user_id, i.email, mp.display_name, mp.status, mp.applied_at, mp.reviewed_at
  ORDER BY coalesce(
    sum(public._merchant_order_volume_usd(mo)) FILTER (WHERE mo.status IN ('completed', 'paid')),
    0
  ) DESC, mp.applied_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merchant_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_merchant_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_merchant_orders(p_merchant_user_id uuid)
RETURNS TABLE (
  id uuid,
  side text,
  status text,
  fiat_amount numeric,
  fiat_currency_code text,
  amount_requested numeric,
  volume_usd numeric,
  created_at timestamptz,
  updated_at timestamptz
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

  IF p_merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'merchant user id required';
  END IF;

  RETURN QUERY
  SELECT
    mo.id,
    mo.side,
    mo.status,
    mo.fiat_amount,
    mo.fiat_currency_code,
    mo.amount_requested,
    public._merchant_order_volume_usd(mo),
    mo.created_at,
    mo.updated_at
  FROM public.merchant_orders mo
  WHERE mo.merchant_user_id = p_merchant_user_id
  ORDER BY mo.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_merchant_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_merchant_orders(uuid) TO authenticated;
