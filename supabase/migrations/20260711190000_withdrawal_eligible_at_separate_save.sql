-- Withdrawal eligibility date: save independently from account status changes.

CREATE OR REPLACE FUNCTION public.admin_set_investor_withdrawal_eligible_at(
  p_investor_id uuid,
  p_withdrawal_eligible_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.admin_set_investor_withdrawal_eligible_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_investor_withdrawal_eligible_at(uuid, timestamptz) TO authenticated;

-- Status updates must not clear or overwrite the withdrawal date.
CREATE OR REPLACE FUNCTION public.admin_update_investor_account_status(
  p_investor_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
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
     AND reason_txt IS NOT DISTINCT FROM nullif(trim(coalesce(inv.status_reason, '')), '') THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  UPDATE public.investors AS i
  SET
    account_status = new_st,
    status = new_st,
    status_reason = reason_txt,
    status_updated_at = (NOW() AT TIME ZONE 'UTC'),
    status_updated_by = auth.uid()
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

REVOKE ALL ON FUNCTION public.admin_update_investor_account_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_investor_account_status(uuid, text, text) TO authenticated;

-- Drop the 4-arg overload if it exists (date is saved via admin_set_investor_withdrawal_eligible_at).
DROP FUNCTION IF EXISTS public.admin_update_investor_account_status(uuid, text, text, timestamptz);

CREATE OR REPLACE FUNCTION public.investor_get_account_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
