-- Restore production compound cooldown: 10 minutes → 23 hours.
-- Also revert vercel.json run-daily-jobs schedule from "*/10 * * * *" back to "0 * * * *" and redeploy.

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

SELECT 'compound interval restored to 23 hours' AS status;
