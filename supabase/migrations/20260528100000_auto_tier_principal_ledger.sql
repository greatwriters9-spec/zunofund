-- Auto tier from qualifying principal only (locked + matured withdrawable principal).
-- Split withdrawable_balance into profit vs principal; FIFO withdrawals consume profit first.
-- Deposits: global minimum only (no per-tier max). Tier recomputed on approve_deposit / approve_withdrawal.

-- ---------------------------------------------------------------------------
-- 1) New ledger columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS withdrawable_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawable_principal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_manual_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.investors.withdrawable_profit IS 'Withdrawable profits (FIFO: withdrawn before principal).';
COMMENT ON COLUMN public.investors.withdrawable_principal IS 'Matured principal available to withdraw.';
COMMENT ON COLUMN public.investors.tier_manual_override IS 'When true, automatic tier sync skips this row (admin manual tier).';

-- ---------------------------------------------------------------------------
-- 2) Backfill profit/principal split
-- Heuristic: principal in withdrawable is capped by sum of matured principal_lock tranches
-- (may overstate if principal was withdrawn; admin can clear override to resync).
-- ---------------------------------------------------------------------------
UPDATE public.investors inv
SET
  withdrawable_principal = sub.wp,
  withdrawable_profit = sub.wpr
FROM (
  SELECT
    i.id,
    LEAST(
      COALESCE(i.withdrawable_balance, 0),
      COALESCE((
        SELECT SUM(pl.principal_amount::numeric)
        FROM public.principal_locks pl
        WHERE pl.matured = true
          AND (
            pl.user_id = i.user_id
            OR lower(trim(pl.investor_email)) = lower(trim(i.email))
          )
      ), 0)
    ) AS wp,
    GREATEST(
      0::numeric,
      COALESCE(i.withdrawable_balance, 0) - LEAST(
        COALESCE(i.withdrawable_balance, 0),
        COALESCE((
          SELECT SUM(pl.principal_amount::numeric)
          FROM public.principal_locks pl
          WHERE pl.matured = true
            AND (
              pl.user_id = i.user_id
              OR lower(trim(pl.investor_email)) = lower(trim(i.email))
            )
        ), 0)
      )
    ) AS wpr
  FROM public.investors i
) sub
WHERE inv.id = sub.id;

UPDATE public.investors
SET withdrawable_balance =
  COALESCE(withdrawable_profit, 0) + COALESCE(withdrawable_principal, 0);

-- ---------------------------------------------------------------------------
-- 3) Generated qualifying principal (must equal locked + matured principal not withdrawn)
-- ---------------------------------------------------------------------------
ALTER TABLE public.investors
  ADD COLUMN tier_qualifying_principal numeric
  GENERATED ALWAYS AS (
    COALESCE(locked_principal_balance, 0) + COALESCE(withdrawable_principal, 0)
  ) STORED;

COMMENT ON COLUMN public.investors.tier_qualifying_principal IS 'Principal basis for automatic tier (generated).';

-- ---------------------------------------------------------------------------
-- 4) Keep withdrawable_balance = profit + principal whenever components change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investors_sync_withdrawable_balance_from_components()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.withdrawable_balance :=
    COALESCE(NEW.withdrawable_profit, 0) + COALESCE(NEW.withdrawable_principal, 0);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.investors_sync_withdrawable_balance_from_components() FROM PUBLIC;

DROP TRIGGER IF EXISTS investors_sync_withdrawable_balance_trg ON public.investors;
CREATE TRIGGER investors_sync_withdrawable_balance_trg
BEFORE INSERT OR UPDATE OF withdrawable_profit, withdrawable_principal
ON public.investors
FOR EACH ROW
EXECUTE FUNCTION public.investors_sync_withdrawable_balance_from_components();

-- ---------------------------------------------------------------------------
-- 5) Lock new financial columns for non-admins
-- ---------------------------------------------------------------------------
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
      NEW.status := OLD.status;
      NEW.email := OLD.email;
      NEW.user_id := OLD.user_id;
      NEW.last_compound_at := OLD.last_compound_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Tier slug from USD principal (Elite→Pro→Growth→Starter precedence at boundaries)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investment_plan_slug_for_principal(p_usd numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_usd, 0) >= 5000 THEN 'Elite'
    WHEN COALESCE(p_usd, 0) >= 1500 THEN 'Pro'
    WHEN COALESCE(p_usd, 0) >= 500 THEN 'Growth'
    WHEN COALESCE(p_usd, 0) >= 200 THEN 'Starter'
    ELSE 'Starter'
  END;
$$;

REVOKE ALL ON FUNCTION public.investment_plan_slug_for_principal(numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_investment_plan_from_principal(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_ov boolean;
  tqp numeric;
  new_slug text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(inv.tier_manual_override, false), inv.tier_qualifying_principal
  INTO is_ov, tqp
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF is_ov THEN
    RETURN;
  END IF;

  new_slug := public.investment_plan_slug_for_principal(tqp);

  UPDATE public.investors AS inv
  SET investment_plan = new_slug
  WHERE inv.user_id = p_user_id
    AND inv.investment_plan IS DISTINCT FROM new_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_investment_plan_from_principal(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_clear_tier_override_and_sync(p_investor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT inv.user_id
  INTO uid
  FROM public.investors AS inv
  WHERE inv.id = p_investor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found';
  END IF;

  UPDATE public.investors AS inv
  SET tier_manual_override = false
  WHERE inv.id = p_investor_id;

  PERFORM public.sync_investment_plan_from_principal(uid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_tier_override_and_sync(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_tier_override_and_sync(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Initial tier sync from backfilled principal (non-manual rows only)
-- ---------------------------------------------------------------------------
UPDATE public.investors AS inv
SET investment_plan = public.investment_plan_slug_for_principal(inv.tier_qualifying_principal)
WHERE coalesce(inv.tier_manual_override, false) = false;

-- ---------------------------------------------------------------------------
-- 8) Deposit validation: minimum $20 only (matches Starter floor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'deposit requires user_id';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'deposit amount must be positive';
  END IF;

  IF NEW.amount::numeric < 20 THEN
    RAISE EXCEPTION
      'deposit amount must be at least 20 USD'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO cnt
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deposits_before_insert_validate_plan_range() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 9) Mature locks → withdrawable_principal (not generic withdrawable bump)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mature_principal_locks(p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.principal_locks
    WHERE matured = false
      AND locked_until <= p_now
    ORDER BY locked_until
    FOR UPDATE
  LOOP
    UPDATE public.principal_locks AS pl
    SET matured = true
    WHERE pl.id = rec.id;

    UPDATE public.investors AS inv
    SET
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - rec.principal_amount::numeric
      ),
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + rec.principal_amount::numeric
    WHERE inv.user_id = rec.user_id
       OR lower(trim(inv.email)) = lower(trim(rec.investor_email));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mature_principal_locks(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 10) Daily compound → withdrawable_profit only (+profits ledger rows)
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
  min_since interval := interval '23 hours';
BEGIN
  FOR inv_row IN SELECT * FROM public.investors LOOP
    IF coalesce(trim(inv_row.status), '') <> 'active' THEN
      CONTINUE;
    END IF;

    IF coalesce(inv_row.balance, 0) <= 0 THEN
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

-- ---------------------------------------------------------------------------
-- 11) Approve deposit → sync tier
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

-- ---------------------------------------------------------------------------
-- 12) Approve withdrawal → FIFO profit then principal → sync tier
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  amt numeric := 0;
  inv_row public.investors%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
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
    RETURN;
  END IF;

  amt := coalesce(w.amount::numeric, 0);

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = w.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor not found for withdrawal';
  END IF;

  take_from_profit := LEAST(amt, coalesce(inv_row.withdrawable_profit, 0));
  remain := amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv_row.withdrawable_principal, 0));

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - take_from_principal
  WHERE inv.user_id = w.user_id
     OR lower(trim(inv.email)) = lower(trim(w.investor_email));

  UPDATE public.withdrawals
  SET status = 'approved'
  WHERE id = p_withdrawal_id;

  PERFORM public.sync_investment_plan_from_principal(inv_row.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;
