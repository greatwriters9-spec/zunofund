-- Merchants may remove unused offers entirely. FK merchant_orders.offer_id ON DELETE RESTRICT
-- forbids deleting offers that appear in order history — those rows must stay; use deactivate instead.

CREATE OR REPLACE FUNCTION public.merchant_delete_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  IF EXISTS (SELECT 1 FROM public.merchant_orders mo WHERE mo.offer_id = p_offer_id) THEN
    RAISE EXCEPTION 'cannot delete an offer that has orders; deactivate it instead'
      USING hint = 'Call merchant_set_offer_status with p_active := false.';
  END IF;

  DELETE FROM public.merchant_offers AS o
  WHERE o.id = p_offer_id
    AND o.merchant_user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'offer not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_delete_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_delete_offer(uuid) TO authenticated;
