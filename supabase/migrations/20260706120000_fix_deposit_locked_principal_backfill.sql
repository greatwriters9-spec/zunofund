-- Repair approved deposits that credited withdrawable_principal instead of locked_principal_balance.
-- Harden approve_deposit so future top-ups always lock principal for 30 days.

-- ---------------------------------------------------------------------------
-- 1) Backfill: move mis-credited deposit principal into locked_principal_balance
-- ---------------------------------------------------------------------------
WITH missing AS (
  SELECT
    d.id AS deposit_id,
    d.user_id,
    lower(trim(coalesce(d.investor_email, ''))) AS investor_email,
    coalesce(d.amount, 0)::numeric AS amount,
    d.created_at
  FROM public.deposits AS d
  WHERE d.status = 'approved'
    AND coalesce(d.amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.principal_locks AS pl
      WHERE pl.deposit_id = d.id
    )
),
by_investor AS (
  SELECT
    m.user_id,
    m.investor_email,
    sum(m.amount) AS repair_total
  FROM missing AS m
  GROUP BY m.user_id, m.investor_email
)
UPDATE public.investors AS inv
SET
  locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bi.repair_total,
  withdrawable_principal = greatest(
    0::numeric,
    coalesce(inv.withdrawable_principal, 0)::numeric - least(
      coalesce(inv.withdrawable_principal, 0)::numeric,
      bi.repair_total
    )
  )
FROM by_investor AS bi
WHERE inv.user_id IS NOT DISTINCT FROM bi.user_id
   OR (
     bi.user_id IS NULL
     AND lower(trim(coalesce(inv.email, ''))) = bi.investor_email
   );

INSERT INTO public.principal_locks (
  deposit_id,
  user_id,
  investor_email,
  principal_amount,
  locked_until,
  lock_source
)
SELECT
  m.deposit_id,
  m.user_id,
  coalesce(trim((SELECT dep.investor_email FROM public.deposits AS dep WHERE dep.id = m.deposit_id)), ''),
  m.amount,
  m.created_at + interval '30 days',
  'deposit'
FROM (
  SELECT
    d.id AS deposit_id,
    d.user_id,
    coalesce(d.amount, 0)::numeric AS amount,
    d.created_at
  FROM public.deposits AS d
  WHERE d.status = 'approved'
    AND coalesce(d.amount, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.principal_locks AS pl
      WHERE pl.deposit_id = d.id
    )
) AS m;

-- Reconcile locked_principal_balance with active (immature) principal locks.
WITH lock_totals AS (
  SELECT
    pl.user_id,
    lower(trim(pl.investor_email)) AS inv_email,
    sum(pl.principal_amount)::numeric AS lock_sum
  FROM public.principal_locks AS pl
  WHERE pl.matured = false
  GROUP BY pl.user_id, lower(trim(pl.investor_email))
)
UPDATE public.investors AS inv
SET locked_principal_balance = coalesce(lt.lock_sum, 0)
FROM lock_totals AS lt
WHERE inv.user_id IS NOT DISTINCT FROM lt.user_id
   OR lower(trim(coalesce(inv.email, ''))) = lt.inv_email;

-- ---------------------------------------------------------------------------
-- 2) approve_deposit: always credit locked principal + create principal_locks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric := 0;
  until_ts timestamptz;
  investor_uid uuid;
  referrer_uid uuid;
  rows_updated integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

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
  IF bump <= 0 THEN
    RAISE EXCEPTION 'invalid deposit amount';
  END IF;

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = p_deposit_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id IS NOT DISTINCT FROM d.user_id
     OR lower(trim(coalesce(inv.email, ''))) = lower(trim(coalesce(d.investor_email, '')));

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF rows_updated = 0 THEN
    RAISE EXCEPTION 'investor not found for deposit %', p_deposit_id;
  END IF;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until,
    lock_source
  )
  VALUES (
    p_deposit_id,
    d.user_id,
    coalesce(trim(d.investor_email), ''),
    bump,
    until_ts,
    'deposit'
  );

  investor_uid := d.user_id;
  IF investor_uid IS NULL THEN
    SELECT inv.user_id
    INTO investor_uid
    FROM public.investors AS inv
    WHERE lower(trim(coalesce(inv.email, ''))) = lower(trim(coalesce(d.investor_email, '')))
    LIMIT 1;
  END IF;

  IF investor_uid IS NOT NULL THEN
    PERFORM public.sync_investment_plan_from_principal(investor_uid);
    PERFORM public.evaluate_investor_rewards_bundle(investor_uid, p_deposit_id);
    PERFORM public.advance_investor_holding_streak(investor_uid);
  END IF;

  PERFORM public.apply_referral_bonus_for_deposit(p_deposit_id);

  IF investor_uid IS NOT NULL THEN
    PERFORM public.evaluate_referral_milestone_rewards(investor_uid);

    SELECT inv.referred_by_user_id
    INTO referrer_uid
    FROM public.investors AS inv
    WHERE inv.user_id = investor_uid;

    IF referrer_uid IS NOT NULL THEN
      PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
