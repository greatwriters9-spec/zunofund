-- TEST ONLY: compound cooldown 23h → 10 minutes. Run restore script when finished.
-- Does not change vercel.json; trigger jobs manually or wait for hourly /api/cron/run-daily-jobs.

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
  min_since interval := interval '10 minutes';
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

SELECT public.admin_prepare_investors_for_compound(true, true) AS prepared;

SELECT public.run_daily_investment_jobs() AS first_run;

SELECT email, balance, total_profit, last_compound_at
FROM public.investors
WHERE coalesce(balance, 0) > 0
ORDER BY email
LIMIT 20;
