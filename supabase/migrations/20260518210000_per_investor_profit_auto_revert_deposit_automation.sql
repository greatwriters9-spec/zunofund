-- Reverts deposit automation (platform_settings / approve_deposit_core / merged notify trigger).
-- Profit: restore ~24h sliding window; add per-investor profit_auto_accrue (default true).

-- ---------------------------------------------------------------------------
-- Deposits: restore original INSERT notifications only (no auto-approve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tp_notify_deposit_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit request received',
    format('We received your deposit request for $%s. Funds will show in your vault after approval.', amt),
    'deposit_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending deposit',
    format('%s requested a deposit for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_deposit'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_inserted() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Deposits: inline approve_deposit (admin RPC only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric := 0;
  until_ts timestamptz;
  sync_uid uuid;
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
    RETURN;
  END IF;

  bump := coalesce(d.amount::numeric, 0);

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = p_deposit_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until
  )
  VALUES (
    p_deposit_id,
    d.user_id,
    coalesce(trim(d.investor_email), ''),
    bump,
    until_ts
  );

  sync_uid := d.user_id;
  IF sync_uid IS NULL THEN
    SELECT inv.user_id
    INTO sync_uid
    FROM public.investors AS inv
    WHERE lower(trim(inv.email)) = lower(trim(d.investor_email))
    LIMIT 1;
  END IF;

  IF sync_uid IS NOT NULL THEN
    PERFORM public.sync_investment_plan_from_principal(sync_uid);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.approve_deposit_core(uuid);

DROP TABLE IF EXISTS public.platform_settings;

-- ---------------------------------------------------------------------------
-- Per-investor: skip automated compound when profit_auto_accrue is false
-- ---------------------------------------------------------------------------
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS profit_auto_accrue boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.investors.profit_auto_accrue IS 'When false, apply_daily_compound_interest skips this row; admin may credit profits manually.';

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF NOT public.is_admin(auth.uid()) THEN
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
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_daily_compound_interest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  pct numeric;
  delta numeric;
  min_since interval := interval '23 hours';
BEGIN
  FOR inv_row IN SELECT * FROM public.investors LOOP
    IF coalesce(trim(inv_row.status), '') <> 'active' THEN
      CONTINUE;
    END IF;

    IF coalesce(inv_row.balance, 0) <= 0 THEN
      CONTINUE;
    END IF;

    IF NOT COALESCE(inv_row.profit_auto_accrue, true) THEN
      CONTINUE;
    END IF;

    IF inv_row.last_compound_at IS NOT NULL
       AND inv_row.last_compound_at > (NOW() AT TIME ZONE 'UTC') - min_since THEN
      CONTINUE;
    END IF;

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
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_daily_compound_interest() TO service_role;
