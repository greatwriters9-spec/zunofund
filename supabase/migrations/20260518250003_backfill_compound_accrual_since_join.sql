-- Service-role RPC: simulated ~23h compound since first deposit / membership; INSERT `compound_backfill` rows.

CREATE OR REPLACE FUNCTION public.backfill_compound_accrual_since_join(
  p_max_ticks integer DEFAULT 400,
  p_now timestamptz DEFAULT NULL
)
RETURNS TABLE (
  investor_id uuid,
  email text,
  simulated_compound numeric,
  logged_compound numeric,
  compound_room numeric,
  credit numeric,
  ticks_applied integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  pct numeric;
  tick_ts timestamptz;
  next_ts timestamptz;
  sim_bal numeric;
  delta numeric;
  flow numeric;
  total_cmp numeric;
  ticks integer;
  max_t integer;
  t_start timestamptz;
  dep_min timestamptz;
  nn timestamptz;
  logged numeric;
  netp numeric;
  manual_tot numeric;
  room numeric;
  credit_amt numeric;
BEGIN
  nn := coalesce(p_now, NOW() AT TIME ZONE 'UTC');

  FOR inv_row IN
    SELECT *
    FROM public.investors AS i
    WHERE lower(trim(coalesce(i.status, ''))) = 'active'
      AND coalesce(i.balance, 0)::numeric > 0
      AND COALESCE(i.profit_auto_accrue, true)
  LOOP
    pct := public.daily_compound_percent_for_plan(inv_row.investment_plan) / 100.0;

    SELECT min((d.created_at AT TIME ZONE 'UTC'))
    INTO dep_min
    FROM public.deposits AS d
    WHERE lower(trim(coalesce(d.status, ''))) = 'approved'
      AND (
        d.user_id IS NOT DISTINCT FROM inv_row.user_id
        OR lower(trim(coalesce(d.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
      );

    t_start := coalesce(dep_min, (inv_row.created_at AT TIME ZONE 'UTC'));

    IF t_start IS NULL OR t_start > nn THEN
      CONTINUE;
    END IF;

    max_t := greatest(1, least(coalesce(p_max_ticks, 400), 10000));
    ticks := 0;
    total_cmp := 0;
    tick_ts := t_start;

    sim_bal :=
      coalesce(
        (
          SELECT sum(d.amount::numeric)
          FROM public.deposits AS d
          WHERE lower(trim(coalesce(d.status, ''))) = 'approved'
            AND (
              d.user_id IS NOT DISTINCT FROM inv_row.user_id
              OR lower(trim(coalesce(d.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
            )
            AND (d.created_at AT TIME ZONE 'UTC') <= tick_ts
        ),
        0::numeric
      )
      - coalesce(
          (
            SELECT sum(w.amount::numeric)
            FROM public.withdrawals AS w
            WHERE lower(trim(coalesce(w.status, ''))) = 'approved'
              AND (
                w.user_id IS NOT DISTINCT FROM inv_row.user_id
                OR lower(trim(coalesce(w.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
              )
              AND (w.created_at AT TIME ZONE 'UTC') <= tick_ts
          ),
          0::numeric
        );

    WHILE tick_ts <= nn AND ticks < max_t LOOP
      delta := round(sim_bal * pct, 8);
      IF delta > 0 THEN
        total_cmp := total_cmp + delta;
        sim_bal := sim_bal + delta;
      END IF;

      next_ts := tick_ts + interval '23 hours';

      flow :=
        coalesce(
          (
            SELECT sum(d.amount::numeric)
            FROM public.deposits AS d
            WHERE lower(trim(coalesce(d.status, ''))) = 'approved'
              AND (
                d.user_id IS NOT DISTINCT FROM inv_row.user_id
                OR lower(trim(coalesce(d.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
              )
              AND (d.created_at AT TIME ZONE 'UTC') > tick_ts
              AND (d.created_at AT TIME ZONE 'UTC') <= next_ts
          ),
          0::numeric
        )
        - coalesce(
            (
              SELECT sum(w.amount::numeric)
              FROM public.withdrawals AS w
              WHERE lower(trim(coalesce(w.status, ''))) = 'approved'
                AND (
                  w.user_id IS NOT DISTINCT FROM inv_row.user_id
                  OR lower(trim(coalesce(w.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
                )
                AND (w.created_at AT TIME ZONE 'UTC') > tick_ts
                AND (w.created_at AT TIME ZONE 'UTC') <= next_ts
            ),
            0::numeric
          );

      sim_bal := sim_bal + flow;
      tick_ts := next_ts;
      ticks := ticks + 1;
    END LOOP;

    SELECT coalesce(sum(p.amount::numeric), 0)
    INTO logged
    FROM public.profits AS p
    WHERE coalesce(trim(p.profit_origin), '') IN ('compound_daily', 'compound_backfill')
      AND (
        p.user_id IS NOT DISTINCT FROM inv_row.user_id
        OR lower(trim(coalesce(p.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
      );

    SELECT
      coalesce(
        (
          SELECT sum(d.amount::numeric)
          FROM public.deposits AS d
          WHERE lower(trim(coalesce(d.status, ''))) = 'approved'
            AND (
              d.user_id IS NOT DISTINCT FROM inv_row.user_id
              OR lower(trim(coalesce(d.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
            )
        ),
        0::numeric
      )
      - coalesce(
          (
            SELECT sum(w.amount::numeric)
            FROM public.withdrawals AS w
            WHERE lower(trim(coalesce(w.status, ''))) = 'approved'
              AND (
                w.user_id IS NOT DISTINCT FROM inv_row.user_id
                OR lower(trim(coalesce(w.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
              )
          ),
          0::numeric
        )
    INTO netp;

    SELECT coalesce(sum(p.amount::numeric), 0)
    INTO manual_tot
    FROM public.profits AS p
    WHERE coalesce(trim(p.profit_origin), '') <> 'compound_daily'
      AND (
        p.user_id IS NOT DISTINCT FROM inv_row.user_id
        OR lower(trim(coalesce(p.investor_email, ''))) = lower(trim(coalesce(inv_row.email, '')))
      );

    room := greatest(
      0::numeric,
      coalesce(inv_row.balance, 0)::numeric - netp - manual_tot
    );

    credit_amt := greatest(0::numeric, round(total_cmp - logged - room, 8));

    IF credit_amt IS NOT NULL AND credit_amt > 0::numeric THEN
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
        credit_amt,
        format(
          'Retroactive compound accrual (~23h cadence since membership; %s simulated ticks)',
          ticks
        ),
        'completed',
        'compound_backfill',
        trim(inv_row.investment_plan)
      );

      UPDATE public.investors AS iu
      SET last_compound_at = nn
      WHERE iu.id = inv_row.id;
    END IF;

    investor_id := inv_row.id;
    email := lower(trim(coalesce(inv_row.email, '')));
    simulated_compound := round(total_cmp, 8);
    logged_compound := round(logged, 8);
    compound_room := round(room, 8);
    credit := round(credit_amt, 8);
    ticks_applied := ticks;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_compound_accrual_since_join(integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_compound_accrual_since_join(integer, timestamptz) TO service_role;
