-- Treat merchants as online only when heartbeat is fresh (matches client stale window).

CREATE OR REPLACE FUNCTION public._merchant_is_effectively_online(
  p_is_online boolean,
  p_last_seen_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_is_online, false)
    AND p_last_seen_at IS NOT NULL
    AND p_last_seen_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes';
$$;

REVOKE ALL ON FUNCTION public._merchant_is_effectively_online(boolean, timestamptz) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.investor_search_merchant_offers(text, numeric, text, text, text);

CREATE FUNCTION public.investor_search_merchant_offers(
  p_side text,
  p_amount numeric DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_fiat_currency_code text DEFAULT NULL,
  p_amount_currency text DEFAULT NULL
)
RETURNS TABLE (
  offer_id uuid,
  merchant_user_id uuid,
  merchant_display_name text,
  merchant_is_online boolean,
  merchant_last_seen_at timestamptz,
  side text,
  payment_methods text[],
  min_limit numeric,
  max_limit numeric,
  rate_percentage numeric,
  payment_instructions text,
  advert_message text,
  fiat_currency_code text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.merchant_user_id,
    mp.display_name,
    public._merchant_is_effectively_online(mp.is_online, mp.last_seen_at),
    mp.last_seen_at,
    o.side,
    o.payment_methods,
    o.min_limit,
    o.max_limit,
    o.rate_percentage,
    o.payment_instructions,
    NULLIF(trim(o.advert_message::text), '') AS advert_message,
    o.fiat_currency_code
  FROM public.merchant_offers AS o
  INNER JOIN public.merchant_profiles AS mp
    ON mp.user_id = o.merchant_user_id AND mp.status = 'active'
  WHERE o.status = 'active'
    AND o.side = p_side
    AND (
      p_amount IS NULL
      OR (
        public._p2p_to_usd(
          p_amount,
          coalesce(nullif(trim(p_amount_currency), ''), nullif(trim(p_fiat_currency_code), ''), o.fiat_currency_code)
        )
        >= public._p2p_to_usd(o.min_limit, o.fiat_currency_code)
        AND public._p2p_to_usd(
          p_amount,
          coalesce(nullif(trim(p_amount_currency), ''), nullif(trim(p_fiat_currency_code), ''), o.fiat_currency_code)
        )
        <= public._p2p_to_usd(o.max_limit, o.fiat_currency_code)
      )
    )
    AND (
      p_payment_method IS NULL
      OR trim(p_payment_method) = ''
      OR p_payment_method = ANY (o.payment_methods)
    )
    AND (
      p_fiat_currency_code IS NULL
      OR trim(p_fiat_currency_code) = ''
      OR upper(p_fiat_currency_code) = o.fiat_currency_code
    )
  ORDER BY o.rate_percentage ASC, o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) TO authenticated;
