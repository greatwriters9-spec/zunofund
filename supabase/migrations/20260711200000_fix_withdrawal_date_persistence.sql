-- Ensure admins can persist withdrawal_eligible_at and clients read it reliably.

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

  IF current_setting('app.tp_allow_investor_ledger_mutation', true) = '1' THEN
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
  NEW.account_status := OLD.account_status;
  NEW.status_reason := OLD.status_reason;
  NEW.status_updated_at := OLD.status_updated_at;
  NEW.status_updated_by := OLD.status_updated_by;
  NEW.withdrawal_eligible_at := OLD.withdrawal_eligible_at;
  NEW.email := OLD.email;
  NEW.user_id := OLD.user_id;
  NEW.last_compound_at := OLD.last_compound_at;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_investor_withdrawal_eligible_at(
  p_investor_id uuid,
  p_withdrawal_eligible_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO inv
  FROM public.investors AS i
  WHERE i.id = p_investor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  IF p_withdrawal_eligible_at IS NOT DISTINCT FROM inv.withdrawal_eligible_at THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  UPDATE public.investors AS i
  SET withdrawal_eligible_at = p_withdrawal_eligible_at
  WHERE i.id = p_investor_id;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_eligible_at', p_withdrawal_eligible_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.investor_get_account_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  st text;
  bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO inv
  FROM public.investors AS i
  WHERE i.user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  st := lower(trim(coalesce(inv.account_status, inv.status, 'active')));
  bal := coalesce(inv.balance, 0);

  RETURN jsonb_build_object(
    'account_status', st,
    'status_reason', inv.status_reason,
    'status_updated_at', inv.status_updated_at,
    'balance', bal,
    'withdrawable_balance', CASE WHEN st = 'banned' THEN bal ELSE coalesce(inv.withdrawable_balance, 0) END,
    'withdrawal_eligible_at', inv.withdrawal_eligible_at,
    'full_name', coalesce(inv.full_name, ''),
    'email', coalesce(inv.email, '')
  );
END;
$$;
