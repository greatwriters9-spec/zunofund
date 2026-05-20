-- P2P sell release: record an approved `withdrawals` row + withdrawal_approved notification,
-- mirroring the wallet withdrawal completion path. Ledger remains in investor_release RPC.
-- Direct client inserts with merchant_order_id are rejected (transaction-local guard).

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS merchant_order_id uuid REFERENCES public.merchant_orders (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.withdrawals.merchant_order_id IS
  'When set, this withdrawal row finalizes a P2P USDT sell (merchant_orders side buy_usdt). One row per order.';

CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_one_per_merchant_order_uidx
  ON public.withdrawals (merchant_order_id)
  WHERE merchant_order_id IS NOT NULL;

-- Allow only our RPC to insert P2P rows (approved) in the same txn after set_config.
CREATE OR REPLACE FUNCTION public.withdrawals_before_insert_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  uid uuid := auth.uid();
  inv_row public.investors%ROWTYPE;
  pending_sum numeric := 0;
  avail numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- P2P: investor_release_merchant_buy_order writes an approved row after applying the same FIFO deduction.
  IF NEW.merchant_order_id IS NOT NULL THEN
    IF current_setting('app.zuno_p2p_withdrawal_insert', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'p2p withdrawal rows can only be created from the P2P release flow';
    END IF;
    IF NEW.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'p2p withdrawals must be approved';
    END IF;
    IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
      RAISE EXCEPTION 'invalid withdrawal amount';
    END IF;

    SELECT *
    INTO inv_row
    FROM public.investors
    WHERE user_id = uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'investor profile not found';
    END IF;

    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;

    NEW.user_id := uid;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  NEW.user_id := uid;

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals AS w
  WHERE w.user_id = uid
    AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF NEW.amount::numeric + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds (principal unlocks after 30 days per deposit; profits accrue separately)',
        hint = format('withdrawable_balance=%s, pending_withdrawals_total=%s', avail, pending_sum);
  END IF;

  RETURN NEW;
END;
$$;

-- Insert trigger: pending wallet requests + P2P instant approved rows.
CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  -- P2P release: single "withdrawal completed" investor notification (no admin pending spam).
  IF NEW.merchant_order_id IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM 'approved' THEN
      RETURN NEW;
    END IF;

    PERFORM public.tp_emit_investor_notification(
      NEW.user_id,
      NEW.investor_email,
      'Withdrawal completed',
      format(
        'Your P2P withdrawal for $%s USDT was completed. Funds were settled to the merchant as agreed.',
        amt
      ),
      'withdrawal_approved'
    );

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal submitted',
    format('We received your withdrawal request for $%s. Our team will review it shortly.', amt),
    'withdrawal_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending withdrawal',
    format('%s requested a withdrawal for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_withdrawal'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.investor_release_merchant_buy_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  bump numeric;
  n integer;
  inv_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.side <> 'buy_usdt' OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := coalesce(mo.usdt_escrow_amount, 0);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'invalid escrow amount';
  END IF;

  SELECT trim(coalesce(email, '')) INTO inv_email
  FROM public.investors
  WHERE user_id = mo.investor_user_id;

  IF trim(coalesce(inv_email, '')) = '' THEN
    RAISE EXCEPTION 'investor email not found';
  END IF;

  IF coalesce(mo.defer_investor_deduction_until_release, false) THEN
    UPDATE public.investors AS inv
    SET
      balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - coalesce(mo.locked_take_from_profit, 0),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - coalesce(mo.locked_take_from_principal, 0)
    WHERE inv.user_id = mo.investor_user_id;

    PERFORM public.sync_investment_plan_from_principal(mo.investor_user_id);
  END IF;

  PERFORM set_config('app.zuno_p2p_withdrawal_insert', '1', true);

  INSERT INTO public.withdrawals (
    user_id,
    investor_email,
    amount,
    wallet_address,
    payment_method,
    status,
    merchant_order_id
  )
  VALUES (
    mo.investor_user_id,
    inv_email,
    bump,
    'P2P — settled to merchant',
    'p2p',
    'approved',
    mo.id
  );

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
  WHERE inv.user_id = mo.merchant_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant investor profile not found';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(mo.merchant_user_id);

  UPDATE public.merchant_orders AS mo2
  SET
    status = 'completed',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_release_merchant_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_release_merchant_buy_order(uuid) TO authenticated;

-- History: label P2P withdrawals distinctly.
CREATE OR REPLACE FUNCTION public.investor_recent_transactions(p_limit integer DEFAULT 150)
RETURNS TABLE (
  id uuid,
  txn_type text,
  amount numeric,
  status text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      d.id,
      'deposit'::text AS txn_type,
      d.amount::numeric AS amt,
      coalesce(d.status, 'completed') AS st,
      'Deposit'::text AS descr,
      d.created_at AS ts
    FROM public.deposits AS d
    WHERE d.user_id = auth.uid()

    UNION ALL

    SELECT
      w.id,
      'withdrawal'::text,
      w.amount::numeric,
      coalesce(w.status, 'completed'),
      CASE
        WHEN w.merchant_order_id IS NOT NULL THEN 'P2P withdrawal'::text
        ELSE 'Withdrawal'::text
      END,
      w.created_at
    FROM public.withdrawals AS w
    WHERE w.user_id = auth.uid()
       OR lower(trim(w.investor_email))
          IS NOT DISTINCT FROM public.request_email()

    UNION ALL

    SELECT
      p.id,
      'profit'::text,
      p.amount::numeric,
      coalesce(p.status, 'completed'),
      coalesce(p.description, 'Profit Added'),
      p.created_at
    FROM public.profits AS p
    WHERE p.user_id = auth.uid()
       OR lower(trim(p.investor_email))
          IS NOT DISTINCT FROM public.request_email()
  )
  SELECT
    base.id,
    base.txn_type,
    base.amt,
    base.st,
    base.descr,
    base.ts
  FROM base
  ORDER BY base.ts DESC
  LIMIT greatest(1, least(coalesce(p_limit, 150), 500));
$$;

REVOKE ALL ON FUNCTION public.investor_recent_transactions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_recent_transactions(integer) TO authenticated;
