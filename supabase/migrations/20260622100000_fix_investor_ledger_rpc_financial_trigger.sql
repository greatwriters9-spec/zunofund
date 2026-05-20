-- P2P (and RPC) withdrawals run as SECURITY DEFINER but auth.uid() is still the caller.
-- investors_prevent_financial_self_edit reverted EVERY non-admin UPDATE to investors, including
-- apply_withdrawal_fifo_deduction on the investor's own row → balance never dropped on release.

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Cron / SQL / service-role paths (auth.jwt absent)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Trusted ledger RPCs mutate the owner's row inside the same transaction (local setting).
  IF current_setting('app.tp_allow_investor_ledger_mutation', true) = '1' THEN
    RETURN NEW;
  END IF;

  -- Allow SECURITY DEFINER flows that credit/debit someone else's investor profile
  -- (e.g. investor invokes release → merchant credited) while blocking direct API self-edit.
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

CREATE OR REPLACE FUNCTION public.apply_withdrawal_fifo_deduction(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
  amt numeric;
BEGIN
  amt := coalesce(p_amount, 0);
  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  take_from_profit := LEAST(amt, coalesce(inv_row.withdrawable_profit, 0));
  remain := amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv_row.withdrawable_principal, 0));

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - take_from_principal
  WHERE inv.user_id = p_user_id
     OR lower(trim(inv.email)) = lower(trim(inv_row.email));

  PERFORM public.sync_investment_plan_from_principal(inv_row.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_withdrawal_fifo_deduction(uuid, numeric) FROM PUBLIC;
