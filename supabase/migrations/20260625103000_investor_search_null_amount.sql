-- Allow browsing all listings by passing NULL p_amount; when set, keep limit overlap semantics.

DROP FUNCTION IF EXISTS public.investor_search_merchant_offers(text, numeric, text);

CREATE OR REPLACE FUNCTION public.investor_search_merchant_offers(
  p_side text,
  p_amount numeric DEFAULT NULL,
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
    AND (
      p_amount IS NULL
      OR (p_amount >= o.min_limit AND p_amount <= o.max_limit)
    )
    AND (
      p_payment_method IS NULL
      OR trim(p_payment_method) = ''
      OR p_payment_method = ANY (o.payment_methods)
    )
  ORDER BY o.rate_percentage ASC, o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.investor_search_merchant_offers(text, numeric, text) IS
  'Investor-facing offer search; pass NULL p_amount to browse all active offers matching side/rail filters.';
