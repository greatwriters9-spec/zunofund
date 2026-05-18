-- Scalability: hot-path indexes, safer compound job (filtered scan + advisory lock),
-- restores profit_auto_accrue + case-insensitive active status after 20260528100000 drift,
-- and a single-call investor transaction feed for /history.

-- ---------------------------------------------------------------------------
-- Indexes (explicit — baseline migrations relied mostly on PKs only)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS investors_user_id_idx
  ON public.investors (user_id);

CREATE INDEX IF NOT EXISTS deposits_user_created_idx
  ON public.deposits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx
  ON public.withdrawals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS withdrawals_investor_email_lower_idx
  ON public.withdrawals ((lower(trim(investor_email))), created_at DESC);

CREATE INDEX IF NOT EXISTS deposits_investor_email_lower_idx
  ON public.deposits ((lower(trim(investor_email))), created_at DESC);

CREATE INDEX IF NOT EXISTS profits_user_created_idx
  ON public.profits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS profits_investor_email_lower_idx
  ON public.profits ((lower(trim(investor_email))), created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_created_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE (is_read IS NOT TRUE);

CREATE INDEX IF NOT EXISTS notifications_email_norm_unread_created_idx
  ON public.notifications ((lower(trim(investor_email))), created_at DESC)
  WHERE (is_read IS NOT TRUE);

CREATE INDEX IF NOT EXISTS deposits_pending_status_created_idx
  ON public.deposits (created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS withdrawals_pending_status_created_idx
  ON public.withdrawals (created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS investors_daily_compound_candidate_idx
  ON public.investors (id ASC)
  WHERE lower(trim(coalesce(status, ''))) = 'active'
    AND coalesce(balance, 0) > 0
    AND COALESCE(profit_auto_accrue, true);

-- ---------------------------------------------------------------------------
-- Investor unified history (replaces triple wide SELECT * + client merge)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_recent_transactions(p_limit integer DEFAULT 150)
RETURNS TABLE (
  id uuid,
  txn_type text,
  amount numeric,
  status text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      d.id,
      'deposit'::text AS txn_type,
      d.amount::numeric AS amt,
      coalesce(d.status, 'completed') AS st,
      'Deposit'::text AS descr,
      d.created_at AS ts
    FROM public.deposits AS d
    WHERE d.user_id = auth.uid()

    UNION ALL

    SELECT
      w.id,
      'withdrawal'::text,
      w.amount::numeric,
      coalesce(w.status, 'completed'),
      'Withdrawal'::text,
      w.created_at
    FROM public.withdrawals AS w
    WHERE w.user_id = auth.uid()
       OR lower(trim(w.investor_email))
          IS NOT DISTINCT FROM public.request_email()

    UNION ALL

    SELECT
      p.id,
      'profit'::text,
      p.amount::numeric,
      coalesce(p.status, 'completed'),
      coalesce(p.description, 'Profit Added'),
      p.created_at
    FROM public.profits AS p
    WHERE p.user_id = auth.uid()
       OR lower(trim(p.investor_email))
          IS NOT DISTINCT FROM public.request_email()
  )
  SELECT
    base.id,
    base.txn_type,
    base.amt,
    base.st,
    base.descr,
    base.ts
  FROM base
  ORDER BY base.ts DESC
  LIMIT greatest(1, least(coalesce(p_limit, 150), 500));
$$;

REVOKE ALL ON FUNCTION public.investor_recent_transactions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_recent_transactions(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Daily compound: filtered candidate scan + skip overlapping cron runs;
-- logic aligned with 20260518250001 (casefold status + profit_auto_accrue).
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
  IF NOT pg_try_advisory_lock(548822671, 928441603) THEN
    RETURN;
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
    END LOOP;

    PERFORM pg_advisory_unlock(548822671, 928441603);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(548822671, 928441603);
      RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_daily_compound_interest() TO service_role;
