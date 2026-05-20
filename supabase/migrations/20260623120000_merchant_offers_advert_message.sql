-- Merchant-set advert blurbs shown on investor P2P marketplace cards.

ALTER TABLE public.merchant_offers
  ADD COLUMN IF NOT EXISTS advert_message text;

COMMENT ON COLUMN public.merchant_offers.advert_message IS
  'Short public pitch shown to investors browsing this offer (optional; max recommended ~500 chars).';

DROP FUNCTION IF EXISTS public.merchant_create_offer(text, text[], numeric, numeric, numeric, text);

CREATE FUNCTION public.merchant_create_offer(
  p_side text,
  p_payment_methods text[],
  p_min_limit numeric,
  p_max_limit numeric,
  p_rate_percentage numeric,
  p_payment_instructions text DEFAULT NULL,
  p_advert_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  nid uuid;
  instr text;
  advert text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  IF p_side NOT IN ('sell_usdt', 'buy_usdt') THEN
    RAISE EXCEPTION 'invalid side';
  END IF;

  IF p_min_limit IS NULL OR p_max_limit IS NULL OR p_min_limit < 0 OR p_max_limit < p_min_limit THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  IF p_side = 'buy_usdt' THEN
    instr := NULL;
  ELSE
    instr := NULLIF(trim(coalesce(p_payment_instructions, '')), '');
  END IF;

  advert := NULLIF(left(trim(coalesce(p_advert_message, '')), 500), '');

  INSERT INTO public.merchant_offers (
    merchant_user_id,
    side,
    payment_methods,
    min_limit,
    max_limit,
    rate_percentage,
    payment_instructions,
    advert_message,
    status
  )
  VALUES (
    auth.uid(),
    p_side,
    coalesce(p_payment_methods, '{}'),
    p_min_limit,
    p_max_limit,
    coalesce(p_rate_percentage, 0),
    instr,
    advert,
    'active'
  )
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_search_merchant_offers(
  p_side text,
  p_amount numeric,
  p_payment_method text DEFAULT NULL
)
RETURNS TABLE (
  offer_id uuid,
  merchant_user_id uuid,
  merchant_display_name text,
  side text,
  payment_methods text[],
  min_limit numeric,
  max_limit numeric,
  rate_percentage numeric,
  payment_instructions text,
  advert_message text
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
    o.side,
    o.payment_methods,
    o.min_limit,
    o.max_limit,
    o.rate_percentage,
    o.payment_instructions,
    NULLIF(trim(o.advert_message::text), '') AS advert_message
  FROM public.merchant_offers AS o
  INNER JOIN public.merchant_profiles AS mp
    ON mp.user_id = o.merchant_user_id AND mp.status = 'active'
  WHERE o.status = 'active'
    AND o.side = p_side
    AND p_amount >= o.min_limit
    AND p_amount <= o.max_limit
    AND (
      p_payment_method IS NULL
      OR trim(p_payment_method) = ''
      OR p_payment_method = ANY (o.payment_methods)
    )
  ORDER BY o.rate_percentage ASC, o.created_at DESC;
$$;
