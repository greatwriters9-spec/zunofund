-- Daily compound updated investors.total_profit but never inserted into `profits`,
-- so charts/history missed automated accruals. Record each accrual as a ledger row.
-- Route notifications via trigger: compound rows emit `profit_compound`; manual rows keep `profit_bonus`.

ALTER TABLE public.profits
  ADD COLUMN IF NOT EXISTS profit_origin text,
  ADD COLUMN IF NOT EXISTS investment_plan_snapshot text;

CREATE OR REPLACE FUNCTION public.tp_notify_profit_row_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt_bonus text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00');
  amt_cmp text := to_char(coalesce(NEW.amount, 0)::numeric, 'FM999999990.00000000');
BEGIN
  IF coalesce(trim(NEW.profit_origin), '') = 'compound_daily' THEN
    PERFORM public.tp_emit_investor_notification(
      NEW.user_id,
      NEW.investor_email,
      'Profit credited',
      format(
        'Daily compound added $%s based on your %s tier returns.',
        amt_cmp,
        coalesce(nullif(trim(NEW.investment_plan_snapshot), ''), 'current')
      ),
      'profit_compound'
    );
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Profit recorded',
    coalesce(trim(NEW.description), format('Profit of $%s was credited to your account.', amt_bonus)),
    'profit_bonus'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_profit_row_inserted() FROM PUBLIC;

DROP TRIGGER IF EXISTS tp_notify_profit_insert ON public.profits;
CREATE TRIGGER tp_notify_profit_insert
AFTER INSERT ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.tp_notify_profit_row_inserted();

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
      withdrawable_balance = coalesce(withdrawable_balance, 0)::numeric + delta,
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
