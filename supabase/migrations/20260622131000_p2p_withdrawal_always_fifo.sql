-- P2P release balances were still unchanged when defer_investor_deduction_until_release = false:
-- approve_withdrawal_core skipped apply_withdrawal_fifo_deduction entirely on that branch.
--
-- Expected product behavior: approving the P2P withdrawal (investor release) always applies the same
-- FIFO deduction as wallet/admin approvals. New sell flows use defer=true; legacy upfront-escrow
-- rows should be uncommon — if double-deduct ever appears on a stale row, correct manually once.
--
-- Also harden bypass for investors_prevent_financial_self_edit: treat config as text NULL-safely.

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.tp_allow_investor_ledger_mutation', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  NEW.balance := OLD.balance;
  NEW.total_profit := OLD.total_profit;
  NEW.locked_principal_balance := OLD.locked_principal_balance;
  NEW.withdrawable_balance := OLD.withdrawable_balance;
  NEW.withdrawable_profit := OLD.withdrawable_profit;
  NEW.withdrawable_principal := OLD.withdrawable_principal;
  NEW.investment_plan := OLD.investment_plan;
  NEW.tier_manual_override := OLD.tier_manual_override;
  NEW.profit_auto_accrue := OLD.profit_auto_accrue;
  NEW.status := OLD.status;
  NEW.email := OLD.email;
  NEW.user_id := OLD.user_id;
  NEW.last_compound_at := OLD.last_compound_at;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal_core(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  amt numeric := 0;
BEGIN
  SELECT *
  INTO w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  amt := coalesce(w.amount::numeric, 0);
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  -- Wallet/exchange OR P2P: same FIFO ledger on approval (release = investor approving P2P).
  PERFORM public.apply_withdrawal_fifo_deduction(w.user_id, amt);

  UPDATE public.withdrawals ww
  SET status = 'approved'
  WHERE ww.id = p_withdrawal_id;
END;
$$;
