-- P2P: auto-expire pending_payment after expires_at (30m) as system-cancelled, not completed_expired.

UPDATE public.merchant_orders
SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
WHERE status = 'completed_expired';

CREATE OR REPLACE FUNCTION public.merchant_expire_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE n integer := 0;
  r public.merchant_orders%ROWTYPE;
BEGIN
  FOR r IN
    SELECT * FROM public.merchant_orders mo
    WHERE mo.status = 'pending_payment' AND mo.expires_at <= (NOW() AT TIME ZONE 'UTC')
    FOR UPDATE
  LOOP
    IF r.side IN ('buy_usdt', 'buy_btc') THEN
      PERFORM public._merchant_restore_sell_escrow(r);
    END IF;
    UPDATE public.merchant_orders mo2
    SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mo2.id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_expire_stale_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_expire_stale_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.merchant_expire_stale_orders() TO authenticated;
