-- Show referral bonus credits in the investor transaction history feed.

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
      CASE
        WHEN w.merchant_order_id IS NOT NULL THEN 'P2P withdrawal'::text
        ELSE 'Withdrawal'::text
      END,
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

    UNION ALL

    SELECT
      rr.id,
      'referral_bonus'::text,
      rr.bonus_amount::numeric,
      'completed'::text,
      format(
        'Referral bonus from approved deposit. Locked until %s.',
        to_char(rr.locked_until, 'Mon DD, YYYY')
      ),
      rr.created_at
    FROM public.referral_rewards AS rr
    WHERE rr.referrer_user_id = auth.uid()
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
