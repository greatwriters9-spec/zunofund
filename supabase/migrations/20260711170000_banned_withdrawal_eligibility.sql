-- Admin-scheduled withdrawal eligibility for restricted accounts (especially banned).

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS withdrawal_eligible_at timestamptz;

COMMENT ON COLUMN public.investors.withdrawal_eligible_at IS
  'When set, informs the investor when funds may become available for withdrawal after a ban/suspension.';

CREATE OR REPLACE FUNCTION public.investor_get_account_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.investors%ROWTYPE;
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

  RETURN jsonb_build_object(
    'account_status', lower(trim(coalesce(inv.account_status, inv.status, 'active'))),
    'status_reason', inv.status_reason,
    'status_updated_at', inv.status_updated_at,
    'balance', coalesce(inv.balance, 0),
    'withdrawable_balance', coalesce(inv.withdrawable_balance, 0),
    'withdrawal_eligible_at', inv.withdrawal_eligible_at,
    'full_name', coalesce(inv.full_name, ''),
    'email', coalesce(inv.email, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_investor_account_status(
  p_investor_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL,
  p_withdrawal_eligible_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  old_st text;
  new_st text := lower(trim(coalesce(p_new_status, '')));
  reason_txt text := nullif(trim(coalesce(p_reason, '')), '');
  label text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  IF new_st NOT IN ('active', 'on_hold', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'invalid account status: %', new_st;
  END IF;

  SELECT * INTO inv
  FROM public.investors AS i
  WHERE i.id = p_investor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  old_st := lower(trim(coalesce(inv.account_status, inv.status, 'active')));

  IF old_st IS NOT DISTINCT FROM new_st
     AND reason_txt IS NOT DISTINCT FROM nullif(trim(coalesce(inv.status_reason, '')), '')
     AND p_withdrawal_eligible_at IS NOT DISTINCT FROM inv.withdrawal_eligible_at THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  UPDATE public.investors AS i
  SET
    account_status = new_st,
    status = new_st,
    status_reason = reason_txt,
    status_updated_at = (NOW() AT TIME ZONE 'UTC'),
    status_updated_by = auth.uid(),
    withdrawal_eligible_at = CASE
      WHEN new_st = 'active' THEN NULL
      ELSE p_withdrawal_eligible_at
    END
  WHERE i.id = p_investor_id;

  INSERT INTO public.account_status_history (
    user_id,
    investor_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  VALUES (
    inv.user_id,
    inv.id,
    old_st,
    new_st,
    reason_txt,
    auth.uid()
  );

  label := initcap(replace(new_st, '_', ' '));

  PERFORM public.tp_emit_investor_notification(
    inv.user_id,
    inv.email,
    format('Account status updated to %s', label),
    format(
      'Your account status has been updated to %s.%s',
      label,
      CASE
        WHEN reason_txt IS NOT NULL THEN E'\n\nReason:\n' || reason_txt
        ELSE ''
      END
    ),
    'account_status'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'old_status', old_st,
    'new_status', new_st
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
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
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
