-- Manual / admin profit rows must credit investor balances.
-- Automated compound inserts profit_origin = 'compound_daily' AFTER the investor row is already updated — skip double-counting.

CREATE OR REPLACE FUNCTION public.profits_after_insert_credit_investor_if_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id uuid;
  amt numeric := coalesce(NEW.amount::numeric, 0);
BEGIN
  IF coalesce(trim(NEW.profit_origin), '') = 'compound_daily' THEN
    RETURN NEW;
  END IF;

  IF amt <= 0 THEN
    RAISE EXCEPTION 'profit amount must be positive for ledger credit';
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT inv.id
    INTO inv_id
    FROM public.investors AS inv
    WHERE inv.user_id = NEW.user_id
    LIMIT 1;
  ELSE
    SELECT inv.id
    INTO inv_id
    FROM public.investors AS inv
    WHERE lower(trim(inv.email)) = lower(trim(coalesce(NEW.investor_email, '')))
    LIMIT 1;
  END IF;

  IF inv_id IS NULL THEN
    RAISE EXCEPTION 'investor not found for profit credit (match user_id or investor_email)';
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + amt,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + amt,
    total_profit = coalesce(inv.total_profit, 0)::numeric + amt
  WHERE inv.id = inv_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profits_after_insert_credit_investor_if_manual() FROM PUBLIC;

DROP TRIGGER IF EXISTS profits_credit_investor_on_manual_insert ON public.profits;

CREATE TRIGGER profits_credit_investor_on_manual_insert
AFTER INSERT ON public.profits
FOR EACH ROW
EXECUTE FUNCTION public.profits_after_insert_credit_investor_if_manual();

-- Later migrations overwrote apply_daily_compound_interest without skipping manual-only investors.
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
