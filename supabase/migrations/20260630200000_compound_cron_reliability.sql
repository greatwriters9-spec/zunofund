-- Compound reliability: return counts from daily jobs, admin prep + diagnostics RPCs.

DROP FUNCTION IF EXISTS public.run_daily_investment_jobs();

DROP FUNCTION IF EXISTS public.apply_daily_compound_interest();

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

CREATE OR REPLACE FUNCTION public.run_daily_investment_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locks_matured integer;
  compounded integer;
BEGIN
  SELECT count(*)::integer
  INTO locks_matured
  FROM public.principal_locks
  WHERE matured = false
    AND locked_until <= NOW();

  PERFORM public.mature_principal_locks(NOW());
  SELECT public.apply_daily_compound_interest() INTO compounded;

  RETURN jsonb_build_object(
    'ok', true,
    'ran_at', (NOW() AT TIME ZONE 'UTC'),
    'principal_locks_due', locks_matured,
    'compounded_investors', compounded
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_investment_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_investment_jobs() TO service_role;

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

CREATE OR REPLACE FUNCTION public.admin_prepare_investors_for_compound(
  p_reset_last_compound boolean DEFAULT true,
  p_only_with_balance boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  UPDATE public.investors AS i
  SET
    status = 'active',
    profit_auto_accrue = true,
    last_compound_at = CASE
      WHEN p_reset_last_compound THEN (NOW() AT TIME ZONE 'UTC') - interval '24 hours'
      ELSE i.last_compound_at
    END
  WHERE (i.user_id IS NULL OR i.user_id NOT IN (SELECT a.user_id FROM public.admins AS a))
    AND (NOT p_only_with_balance OR coalesce(i.balance, 0) > 0);

  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'investors_updated', updated,
    'reset_last_compound', p_reset_last_compound,
    'only_with_balance', p_only_with_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_investors_for_compound(boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_prepare_investors_for_compound(boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_investors_for_compound(boolean, boolean) TO service_role;
