-- Admin reject/cancel for pending deposits and withdrawals.
-- Deposits: mark rejected (no balance change — never credited while pending).
-- Withdrawals: mark rejected and restore ledger when funds were reserved at submit.

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note text;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS deducted_from_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deducted_from_principal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note text;

CREATE OR REPLACE FUNCTION public.reverse_crypto_withdrawal_deduction(
  p_user_id uuid,
  p_take_from_profit numeric,
  p_take_from_principal numeric,
  p_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  profit_restore numeric := round(coalesce(p_take_from_profit, 0), 8);
  principal_restore numeric := round(coalesce(p_take_from_principal, 0), 8);
  total_restore numeric := round(coalesce(p_total, 0), 8);
BEGIN
  IF total_restore <= 0 THEN
    RETURN;
  END IF;

  IF profit_restore + principal_restore <> total_restore THEN
    RAISE EXCEPTION 'withdrawal reversal split must match total amount';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + total_restore,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + profit_restore,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + principal_restore
  WHERE inv.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found for withdrawal reversal';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_crypto_withdrawal_deduction(uuid, numeric, numeric, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reject_deposit(
  p_deposit_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  d public.deposits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit not found';
  END IF;

  IF d.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'only pending deposits can be rejected';
  END IF;

  UPDATE public.deposits AS dep
  SET
    status = 'rejected',
    rejected_at = (NOW() AT TIME ZONE 'UTC'),
    rejected_by = auth.uid(),
    admin_note = NULLIF(trim(p_admin_note), '')
  WHERE dep.id = p_deposit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_deposit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_deposit(
  p_deposit_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  PERFORM public.reject_deposit(p_deposit_id, p_admin_note);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_deposit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_deposit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_withdrawal_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  amt numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  IF w.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'only pending withdrawals can be rejected';
  END IF;

  IF w.merchant_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'p2p-linked withdrawals cannot be rejected here';
  END IF;

  amt := round(coalesce(w.amount::numeric, 0), 8);

  IF coalesce(w.ledger_deducted, false) THEN
    IF coalesce(w.deducted_from_profit, 0) + coalesce(w.deducted_from_principal, 0) > 0 THEN
      PERFORM public.reverse_crypto_withdrawal_deduction(
        w.user_id,
        coalesce(w.deducted_from_profit, 0),
        coalesce(w.deducted_from_principal, 0),
        amt
      );
    ELSE
      -- Legacy rows submitted before split columns existed.
      PERFORM public.reverse_crypto_withdrawal_deduction(w.user_id, 0, amt, amt);
    END IF;
  END IF;

  UPDATE public.withdrawals AS ww
  SET
    status = 'rejected',
    rejected_at = (NOW() AT TIME ZONE 'UTC'),
    rejected_by = auth.uid(),
    admin_note = NULLIF(trim(p_admin_note), '')
  WHERE ww.id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_withdrawal(
  p_withdrawal_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  PERFORM public.reject_withdrawal(p_withdrawal_id, p_admin_note);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_withdrawal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_withdrawal(uuid, text) TO authenticated;

-- Record FIFO split on submit so rejection restores exact buckets.
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
  mo_row public.merchant_orders%ROWTYPE;
  usdt_amt numeric;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  IF NEW.merchant_order_id IS NOT NULL THEN
    IF current_setting('app.zuno_p2p_withdrawal_pending_insert', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'p2p withdrawals must be created from the investor release flow';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'p2p withdrawal rows must start as pending';
    END IF;

    SELECT * INTO mo_row FROM public.merchant_orders WHERE id = NEW.merchant_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'merchant order not found'; END IF;
    IF mo_row.investor_user_id <> uid THEN RAISE EXCEPTION 'not your p2p order'; END IF;
    IF mo_row.side NOT IN ('buy_usdt', 'buy_btc') OR mo_row.status <> 'paid' THEN
      RAISE EXCEPTION 'invalid p2p order state for withdrawal';
    END IF;

    usdt_amt := public._p2p_order_usdt_escrow(mo_row);
    IF NEW.amount::numeric IS DISTINCT FROM usdt_amt THEN
      RAISE EXCEPTION 'p2p withdrawal amount must match escrow';
    END IF;

    SELECT * INTO inv_row FROM public.investors WHERE user_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
    IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
      RAISE EXCEPTION 'email mismatch for withdrawal';
    END IF;
    NEW.user_id := uid;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  NEW.user_id := uid;
  usdt_amt := public._withdrawal_input_to_usdt(NEW.amount::numeric, NEW.payment_method);

  SELECT * INTO inv_row FROM public.investors WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'investor profile not found'; END IF;
  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals AS w
  WHERE w.user_id = uid AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF usdt_amt + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds',
        hint = format('usdt_available=%s, pending_total=%s', avail, pending_sum);
  END IF;

  take_from_profit := LEAST(usdt_amt, coalesce(inv_row.withdrawable_profit, 0));
  remain := usdt_amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv_row.withdrawable_principal, 0));

  IF take_from_profit + take_from_principal < usdt_amt THEN
    RAISE EXCEPTION 'insufficient withdrawable funds';
  END IF;

  PERFORM public.apply_crypto_withdrawal_deduction(uid, usdt_amt, 'USDT');
  NEW.amount := usdt_amt;
  NEW.ledger_deducted := true;
  NEW.deducted_from_profit := take_from_profit;
  NEW.deducted_from_principal := take_from_principal;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_deposit_rejected_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'rejected' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit not approved',
    format('Your deposit request for $%s was not approved. Contact support if you have questions.', amt),
    'deposit_rejected'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_rejected_row() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_deposit_rejected ON public.deposits;
CREATE TRIGGER tp_notify_deposit_rejected
AFTER UPDATE ON public.deposits
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_deposit_rejected_row();

CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_rejected_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'rejected' THEN
    RETURN NEW;
  END IF;

  IF NEW.merchant_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal cancelled',
    format('Your withdrawal request for $%s was cancelled. Funds were returned to your available balance.', amt),
    'withdrawal_rejected'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_withdrawal_rejected_row() FROM PUBLIC;
DROP TRIGGER IF EXISTS tp_notify_withdrawal_rejected ON public.withdrawals;
CREATE TRIGGER tp_notify_withdrawal_rejected
AFTER UPDATE ON public.withdrawals
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_withdrawal_rejected_row();
