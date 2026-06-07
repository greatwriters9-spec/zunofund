-- Tier daily rates: Starter 10%, Growth 20%, Pro 30%, Elite 50%.
-- Crypto deposit minimum $100. Interest accrues only when tier_qualifying_principal >= $100.

CREATE OR REPLACE FUNCTION public.daily_compound_percent_for_plan(plan text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%elite%' THEN 50::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%growth%' THEN 20::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%pro%' THEN 30::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%starter%' THEN 10::numeric
    ELSE 10::numeric
  END;
$$;

REVOKE ALL ON FUNCTION public.daily_compound_percent_for_plan(text) FROM PUBLIC;

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
    WHEN COALESCE(p_usd, 0) >= 100 THEN 'Starter'
    ELSE 'Starter'
  END;
$$;

REVOKE ALL ON FUNCTION public.investment_plan_slug_for_principal(numeric) FROM PUBLIC;

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

  SELECT count(*) INTO cnt
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  IF coalesce(NEW.skip_plan_amount_validation, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.amount::numeric < 100 THEN
    RAISE EXCEPTION
      'deposit amount must be at least 100 USD'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deposits_before_insert_validate_plan_range() FROM PUBLIC;

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
BEGIN
  IF NOT pg_try_advisory_lock(548822671, 928441603) THEN
    RETURN 0;
  END IF;

  BEGIN
    FOR inv_row IN
      SELECT *
      FROM public.investors AS i
      WHERE lower(trim(coalesce(i.status, ''))) = 'active'
        AND coalesce(i.balance, 0) > 0
        AND coalesce(i.tier_qualifying_principal, 0) >= 100
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
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(548822671, 928441603);
      RAISE;
  END;

  RETURN credited;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_daily_compound_interest() TO service_role;

CREATE OR REPLACE FUNCTION public.compound_eligibility_report()
RETURNS TABLE (
  investor_id uuid,
  email text,
  status text,
  balance numeric,
  investment_plan text,
  profit_auto_accrue boolean,
  last_compound_at timestamptz,
  eligibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.email,
    i.status,
    coalesce(i.balance, 0),
    i.investment_plan,
    COALESCE(i.profit_auto_accrue, true),
    i.last_compound_at,
    CASE
      WHEN lower(trim(coalesce(i.status, ''))) <> 'active' THEN 'not_active'
      WHEN coalesce(i.balance, 0) <= 0 THEN 'no_balance'
      WHEN coalesce(i.tier_qualifying_principal, 0) < 100 THEN 'below_interest_floor'
      WHEN i.profit_auto_accrue = false THEN 'auto_accrue_off'
      WHEN i.last_compound_at IS NOT NULL
           AND i.last_compound_at > (NOW() AT TIME ZONE 'UTC') - interval '23 hours'
        THEN 'within_23h_cooldown'
      ELSE 'eligible'
    END
  FROM public.investors AS i
  WHERE i.user_id IS NULL
     OR i.user_id NOT IN (SELECT a.user_id FROM public.admins AS a)
  ORDER BY i.email;
$$;

REVOKE ALL ON FUNCTION public.compound_eligibility_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compound_eligibility_report() TO service_role;
