-- Centralized investor account status: active | on_hold | suspended | banned

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_account_status_check;

ALTER TABLE public.investors
  ADD CONSTRAINT investors_account_status_check
  CHECK (account_status IN ('active', 'on_hold', 'suspended', 'banned'));

-- Backfill from legacy status column when present.
UPDATE public.investors AS i
SET account_status = CASE
  WHEN lower(trim(coalesce(i.status, ''))) IN ('active', 'on_hold', 'suspended', 'banned')
    THEN lower(trim(i.status))
  ELSE 'active'
END
WHERE i.account_status IS DISTINCT FROM CASE
  WHEN lower(trim(coalesce(i.status, ''))) IN ('active', 'on_hold', 'suspended', 'banned')
    THEN lower(trim(i.status))
  ELSE 'active'
END;

CREATE TABLE IF NOT EXISTS public.account_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors (id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS account_status_history_user_id_idx
  ON public.account_status_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_status_history_investor_id_idx
  ON public.account_status_history (investor_id, created_at DESC);

ALTER TABLE public.account_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_status_history_admin_select ON public.account_status_history;
CREATE POLICY account_status_history_admin_select
  ON public.account_status_history
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.account_status_history TO authenticated;

-- Normalize status from account_status (fallback to legacy status).
CREATE OR REPLACE FUNCTION public.investor_account_status_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(
    i.account_status,
    i.status,
    'active'
  )))
  FROM public.investors AS i
  WHERE i.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.investor_account_status_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_account_status_for_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_require_account_action_for_user(
  p_user_id uuid,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st text;
  act text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  st := public.investor_account_status_for_user(p_user_id);

  IF st IS NULL THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  IF st = 'active' THEN
    RETURN;
  END IF;

  IF st = 'on_hold' THEN
    IF act IN ('deposit', 'withdraw', 'invest', 'p2p', 'transfer', 'order') THEN
      RAISE EXCEPTION 'account on hold: % is not permitted', act
        USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;

  IF act IN ('deposit', 'withdraw', 'invest', 'p2p', 'transfer', 'order', 'profit_accrue') THEN
    RAISE EXCEPTION 'account %: % is not permitted', st, act
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_require_account_action_for_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_require_account_action_for_user(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_require_account_action(p_action text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  PERFORM public.investor_require_account_action_for_user(auth.uid(), p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.investor_require_account_action(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_require_account_action(text) TO authenticated;

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
    'full_name', coalesce(inv.full_name, ''),
    'email', coalesce(inv.email, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.investor_get_account_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_get_account_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_account_status_history(p_investor_id uuid)
RETURNS SETOF public.account_status_history
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT h.*
  FROM public.account_status_history AS h
  WHERE h.investor_id = p_investor_id
  ORDER BY h.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_account_status_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_account_status_history(uuid) TO authenticated;

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

-- Lock account status fields from self-edit.
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
      NEW.email := OLD.email;
      NEW.user_id := OLD.user_id;
      NEW.last_compound_at := OLD.last_compound_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Signup: set account_status on new investors.
CREATE OR REPLACE FUNCTION public.sync_investor_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  fn text := NULLIF(trim(meta->>'first_name'), '');
  mn text := NULLIF(trim(meta->>'middle_name'), '');
  sn text := NULLIF(trim(meta->>'surname'), '');
  full_nm text := NULLIF(trim(meta->>'full_name'), '');
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.investors WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF full_nm IS NULL AND (fn IS NOT NULL OR sn IS NOT NULL) THEN
    full_nm := trim(concat_ws(' ', fn, mn, sn));
  END IF;

  INSERT INTO public.investors (
    user_id,
    email,
    full_name,
    first_name,
    middle_name,
    surname,
    dob,
    phone,
    balance,
    total_profit,
    investment_plan,
    status,
    account_status
  )
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE(full_nm, ''),
    fn,
    mn,
    sn,
    CASE
      WHEN meta ? 'dob' AND length(trim(meta->>'dob')) > 0 THEN (trim(meta->>'dob'))::date
      ELSE NULL
    END,
    NULLIF(trim(meta->>'phone'), ''),
    0,
    0,
    COALESCE(NULLIF(trim(meta->>'investment_plan'), ''), 'Starter'),
    'active',
    'active'
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'sync_investor_profile_from_auth_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Deposit / withdrawal guards.
CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
  min_usd numeric;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'deposit requires user_id';
  END IF;

  PERFORM public.investor_require_account_action_for_user(NEW.user_id, 'deposit');

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'deposit amount must be positive';
  END IF;

  SELECT count(*) INTO cnt
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  IF coalesce(NEW.skip_plan_amount_validation, false) THEN
    RETURN NEW;
  END IF;

  min_usd := public.platform_min_deposit_usd();

  IF NEW.amount::numeric < min_usd THEN
    RAISE EXCEPTION
      'deposit amount must be at least % USD', min_usd
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdrawals_before_insert_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  PERFORM public.investor_require_account_action_for_user(uid, 'withdraw');

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
  FROM public.withdrawals w
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

-- P2P order creation guard.
CREATE OR REPLACE FUNCTION public.merchant_orders_before_insert_investor_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.investor_user_id IS NOT NULL THEN
    PERFORM public.investor_require_account_action_for_user(NEW.investor_user_id, 'p2p');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merchant_orders_investor_account_before_insert ON public.merchant_orders;
CREATE TRIGGER merchant_orders_investor_account_before_insert
  BEFORE INSERT ON public.merchant_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.merchant_orders_before_insert_investor_account();

-- Profit engine: only active accounts accrue; no backfill on restore.
CREATE OR REPLACE FUNCTION public.apply_daily_compound_interest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  pct numeric;
  delta numeric;
  min_since interval := interval '23 hours';
  credited integer := 0;
  min_principal numeric;
BEGIN
  min_principal := public.platform_min_deposit_usd();

  IF NOT pg_try_advisory_lock(548822671, 928441603) THEN
    RETURN 0;
  END IF;

  BEGIN
    FOR inv_row IN
      SELECT *
      FROM public.investors AS i
      WHERE lower(trim(coalesce(i.account_status, i.status, ''))) = 'active'
        AND coalesce(i.balance, 0) > 0
        AND coalesce(i.tier_qualifying_principal, 0) >= min_principal
        AND COALESCE(i.profit_auto_accrue, true)
        AND (
          i.last_compound_at IS NULL
          OR i.last_compound_at <= (NOW() AT TIME ZONE 'UTC') - min_since
        )
      ORDER BY i.id
    LOOP
      pct := public.daily_compound_percent_for_plan(inv_row.investment_plan) / 100.0;
      delta := round(coalesce(inv_row.balance, 0)::numeric * pct, 8);

      IF delta <= 0 THEN
        UPDATE public.investors
        SET last_compound_at = (NOW() AT TIME ZONE 'UTC')
        WHERE id = inv_row.id;
        CONTINUE;
      END IF;

      UPDATE public.investors
      SET
        balance = coalesce(balance, 0)::numeric + delta,
        withdrawable_profit = coalesce(withdrawable_profit, 0)::numeric + delta,
        total_profit = coalesce(total_profit, 0)::numeric + delta,
        last_compound_at = (NOW() AT TIME ZONE 'UTC')
      WHERE id = inv_row.id;

      INSERT INTO public.profits (
        user_id,
        investor_email,
        amount,
        description,
        status,
        profit_origin,
        investment_plan_snapshot
      )
      VALUES (
        inv_row.user_id,
        lower(trim(coalesce(inv_row.email, ''))),
        delta,
        format(
          'Daily compound accrual (%s tier)',
          coalesce(nullif(trim(inv_row.investment_plan), ''), 'current')
        ),
        'completed',
        'compound_daily',
        trim(inv_row.investment_plan)
      );

      credited := credited + 1;
    END LOOP;

    PERFORM pg_advisory_unlock(548822671, 928441603);
    RETURN credited;
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(548822671, 928441603);
      RAISE;
  END;
END;
$$;

-- Realtime: push account status changes to open sessions.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'investors'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.investors;
    END IF;
  END IF;
END;
$$;
