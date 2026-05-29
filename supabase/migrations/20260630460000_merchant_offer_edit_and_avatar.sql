-- Editable merchant offers + investor profile avatar on marketplace listings.

CREATE OR REPLACE FUNCTION public.merchant_update_offer(
  p_offer_id uuid,
  p_payment_methods text[],
  p_min_limit numeric,
  p_max_limit numeric,
  p_rate_percentage numeric,
  p_payment_instructions text DEFAULT NULL,
  p_advert_message text DEFAULT NULL,
  p_fiat_currency_code text DEFAULT 'USD'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  off public.merchant_offers%ROWTYPE;
  instr text;
  advert text;
  ccy text;
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  SELECT * INTO off
  FROM public.merchant_offers
  WHERE id = p_offer_id
    AND merchant_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF p_min_limit IS NULL OR p_max_limit IS NULL OR p_min_limit < 0 OR p_max_limit < p_min_limit THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  ccy := upper(coalesce(nullif(trim(p_fiat_currency_code), ''), 'USD'));
  IF length(ccy) <> 3 THEN
    RAISE EXCEPTION 'invalid fiat currency code: %', ccy;
  END IF;

  IF off.side IN ('buy_usdt', 'buy_btc') THEN
    instr := NULL;
  ELSE
    instr := NULLIF(trim(coalesce(p_payment_instructions, '')), '');
  END IF;

  advert := NULLIF(left(trim(coalesce(p_advert_message, '')), 500), '');

  UPDATE public.merchant_offers AS o
  SET
    payment_methods = coalesce(p_payment_methods, '{}'),
    min_limit = p_min_limit,
    max_limit = p_max_limit,
    rate_percentage = coalesce(p_rate_percentage, 0),
    payment_instructions = instr,
    advert_message = advert,
    fiat_currency_code = ccy,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE o.id = p_offer_id
    AND o.merchant_user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'offer not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_update_offer(uuid, text[], numeric, numeric, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_update_offer(uuid, text[], numeric, numeric, numeric, text, text, text) TO authenticated;

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
  merchant_presence_mode text,
  merchant_avatar_url text,
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
    mp.is_online,
    mp.last_seen_at,
    mp.presence_mode,
    NULLIF(trim(inv.avatar_url::text), '') AS merchant_avatar_url,
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
  LEFT JOIN public.investors AS inv
    ON inv.user_id = o.merchant_user_id
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
  ORDER BY
    public._merchant_is_effectively_online(mp.is_online, mp.last_seen_at, mp.presence_mode) DESC,
    o.rate_percentage ASC,
    o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) TO authenticated;
