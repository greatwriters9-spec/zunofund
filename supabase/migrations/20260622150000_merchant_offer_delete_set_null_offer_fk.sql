-- Allow deleting merchant offers whenever there are no *active* trades (pending_payment, paid).
-- Completed/cancelled orders keep their row history; offer_id becomes NULL via ON DELETE SET NULL.

ALTER TABLE public.merchant_orders
  DROP CONSTRAINT IF EXISTS merchant_orders_offer_id_fkey;

ALTER TABLE public.merchant_orders
  ALTER COLUMN offer_id DROP NOT NULL;

ALTER TABLE public.merchant_orders
  ADD CONSTRAINT merchant_orders_offer_id_fkey
  FOREIGN KEY (offer_id) REFERENCES public.merchant_offers (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.merchant_orders.offer_id IS
  'Listing this trade opened from; set NULL if the merchant deleted the offer after the trade ended.';

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

  IF EXISTS (
    SELECT 1
    FROM public.merchant_orders mo
    WHERE mo.offer_id = p_offer_id
      AND mo.status IN ('pending_payment', 'paid')
  ) THEN
    RAISE EXCEPTION 'cannot delete an offer while it has an active trade — wait until the trade completes, is cancelled, or expires.'
      USING hint = 'Active trades are statuses pending_payment or paid.';
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

-- Merchants may not SELECT other investors under default RLS; expose minimal profile for P2P counterparties.
CREATE OR REPLACE FUNCTION public.merchant_list_counterparty_profiles(p_investor_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
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
    NULLIF(trim(coalesce(i.full_name::text, '')), '') AS full_name
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
