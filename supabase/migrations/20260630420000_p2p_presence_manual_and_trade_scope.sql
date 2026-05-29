-- P2P presence: merchant manual online/offline + investor trade-page presence for counterparties.

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS presence_mode text NOT NULL DEFAULT 'auto';

ALTER TABLE public.merchant_profiles
  DROP CONSTRAINT IF EXISTS merchant_profiles_presence_mode_check;

ALTER TABLE public.merchant_profiles
  ADD CONSTRAINT merchant_profiles_presence_mode_check
  CHECK (presence_mode IN ('auto', 'manual_online', 'manual_offline'));

CREATE OR REPLACE FUNCTION public._merchant_is_effectively_online(
  p_is_online boolean,
  p_last_seen_at timestamptz,
  p_presence_mode text DEFAULT 'auto'
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_presence_mode, 'auto') = 'manual_online' THEN coalesce(p_is_online, false)
    WHEN coalesce(p_presence_mode, 'auto') = 'manual_offline' THEN false
    ELSE
      coalesce(p_is_online, false)
      AND p_last_seen_at IS NOT NULL
      AND p_last_seen_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes'
  END;
$$;

REVOKE ALL ON FUNCTION public._merchant_is_effectively_online(boolean, timestamptz, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._investor_is_effectively_online(
  p_is_online boolean,
  p_last_seen_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(p_is_online, false)
    AND p_last_seen_at IS NOT NULL
    AND p_last_seen_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes';
$$;

REVOKE ALL ON FUNCTION public._investor_is_effectively_online(boolean, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.merchant_set_presence_mode(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mode text := lower(trim(coalesce(p_mode, '')));
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF mode NOT IN ('manual_online', 'manual_offline') THEN
    RAISE EXCEPTION 'invalid presence mode';
  END IF;

  UPDATE public.merchant_profiles mp
  SET
    presence_mode = mode,
    is_online = (mode = 'manual_online'),
    last_seen_at = CASE
      WHEN mode = 'manual_online' THEN (NOW() AT TIME ZONE 'UTC')
      ELSE mp.last_seen_at
    END,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'active';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'active merchant profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_set_presence_mode(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_set_presence_mode(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_set_presence(p_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
  mode text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT mp.presence_mode
  INTO mode
  FROM public.merchant_profiles mp
  WHERE mp.user_id = auth.uid()
    AND mp.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active merchant profile not found';
  END IF;

  IF coalesce(mode, 'auto') <> 'auto' THEN
    RETURN;
  END IF;

  IF coalesce(p_online, false) THEN
    UPDATE public.merchant_profiles mp
    SET
      is_online = true,
      last_seen_at = (NOW() AT TIME ZONE 'UTC'),
      updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mp.user_id = auth.uid()
      AND mp.status = 'active';
  ELSE
    UPDATE public.merchant_profiles mp
    SET
      is_online = false,
      updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mp.user_id = auth.uid()
      AND mp.status = 'active';
  END IF;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'active merchant profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.investor_set_presence(p_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF coalesce(p_online, false) THEN
    UPDATE public.investors AS i
    SET
      is_online = true,
      last_seen_at = (NOW() AT TIME ZONE 'UTC')
    WHERE i.user_id = auth.uid();
  ELSE
    UPDATE public.investors AS i
    SET is_online = false
    WHERE i.user_id = auth.uid();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.merchant_get_order_investor_presence(p_order_id uuid)
RETURNS TABLE (
  is_online boolean,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    i.is_online,
    i.last_seen_at
  FROM public.merchant_orders AS mo
  INNER JOIN public.investors AS i ON i.user_id = mo.investor_user_id
  WHERE mo.id = p_order_id
    AND mo.merchant_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.merchant_get_order_investor_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_get_order_investor_presence(uuid) TO authenticated;

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
  ORDER BY
    public._merchant_is_effectively_online(mp.is_online, mp.last_seen_at, mp.presence_mode) DESC,
    o.rate_percentage ASC,
    o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) TO authenticated;
