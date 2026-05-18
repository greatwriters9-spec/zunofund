-- NOTE: Deposit automation below was reverted by migration 20260518210000_per_investor_profit_auto_revert_deposit_automation.sql (keep file order for fresh installs).
-- Daily profit: at most once per UTC calendar day per investor; percent of current balance per tier (compound).
-- Deposit approval: optional automatic approve via platform_settings.deposits_auto_approve (manual still supported).
-- Consolidates auto-approve into tp_notify_deposit_inserted so notifications stay ordered.

-- ---------------------------------------------------------------------------
-- Platform toggles (singleton row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deposits_auto_approve boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, deposits_auto_approve)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS 'Singleton operational toggles (id must be 1).';

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_select_authenticated ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_select_admin ON public.platform_settings;
CREATE POLICY platform_settings_select_admin
ON public.platform_settings
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS platform_settings_update_admin ON public.platform_settings;
CREATE POLICY platform_settings_update_admin
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Deposit approval core (no auth check - internal + admin RPC wrapper only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_deposit_core(p_deposit_id uuid)
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

REVOKE ALL ON FUNCTION public.approve_deposit_core(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM public.approve_deposit_core(p_deposit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Daily compound: one accrual per UTC calendar day; % of current balance (tier)
-- ---------------------------------------------------------------------------
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
  today_utc date;
  last_day_utc date;
BEGIN
  today_utc := (now() AT TIME ZONE 'UTC')::date;

  FOR inv_row IN SELECT * FROM public.investors LOOP
    IF coalesce(trim(inv_row.status), '') <> 'active' THEN
      CONTINUE;
    END IF;

    IF coalesce(inv_row.balance, 0) <= 0 THEN
      CONTINUE;
    END IF;

    IF inv_row.last_compound_at IS NOT NULL THEN
      last_day_utc := (inv_row.last_compound_at AT TIME ZONE 'UTC')::date;
      IF last_day_utc >= today_utc THEN
        CONTINUE;
      END IF;
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

-- ---------------------------------------------------------------------------
-- Deposit INSERT: manual -> pending notifications; automatic -> approve immediately (no duplicate pending noise)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tp_notify_deposit_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
  auto_appr boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT ps.deposits_auto_approve
  INTO auto_appr
  FROM public.platform_settings AS ps
  WHERE ps.id = 1;

  IF COALESCE(auto_appr, false) THEN
    PERFORM public.approve_deposit_core(NEW.id);
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
