-- Service-role RPC: credit balances for manual `profits` rows missing from investor totals.

CREATE OR REPLACE FUNCTION public.repair_manual_profit_balance_gaps()
RETURNS TABLE (
  investor_id uuid,
  email text,
  shortfall numeric,
  manual_total numeric,
  net_principal numeric,
  balance_before numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH inv AS (
    SELECT
      i.id AS investor_id,
      lower(trim(i.email)) AS email,
      i.user_id AS uid,
      coalesce(i.balance, 0)::numeric AS balance_before
    FROM public.investors AS i
  ),
  manual_by_inv AS (
    SELECT
      inv.investor_id,
      sum(p.amount::numeric) AS manual_total
    FROM public.profits AS p
    INNER JOIN inv ON inv.uid IS NOT DISTINCT FROM p.user_id
      OR (
        p.user_id IS NULL
        AND lower(trim(coalesce(p.investor_email, ''))) = inv.email
      )
    WHERE coalesce(trim(p.profit_origin), '') <> 'compound_daily'
    GROUP BY inv.investor_id
  ),
  dep_by_inv AS (
    SELECT
      inv.investor_id,
      sum(d.amount::numeric) AS dep_total
    FROM public.deposits AS d
    INNER JOIN inv ON d.user_id = inv.uid
      OR lower(trim(coalesce(d.investor_email, ''))) = inv.email
    WHERE lower(trim(coalesce(d.status, ''))) = 'approved'
    GROUP BY inv.investor_id
  ),
  wdl_by_inv AS (
    SELECT
      inv.investor_id,
      sum(w.amount::numeric) AS w_total
    FROM public.withdrawals AS w
    INNER JOIN inv ON w.user_id = inv.uid
      OR lower(trim(coalesce(w.investor_email, ''))) = inv.email
    WHERE lower(trim(coalesce(w.status, ''))) = 'approved'
    GROUP BY inv.investor_id
  ),
  gaps AS (
    SELECT
      inv.investor_id,
      inv.email,
      inv.balance_before,
      coalesce(m.manual_total, 0)::numeric AS manual_total,
      (coalesce(d.dep_total, 0) - coalesce(w.w_total, 0))::numeric AS net_principal,
      greatest(
        0::numeric,
        least(
          coalesce(m.manual_total, 0)::numeric,
          coalesce(m.manual_total, 0)::numeric
            - (inv.balance_before - (coalesce(d.dep_total, 0) - coalesce(w.w_total, 0)))
        )
      ) AS shortfall
    FROM inv
    INNER JOIN manual_by_inv AS m ON m.investor_id = inv.investor_id
    LEFT JOIN dep_by_inv AS d ON d.investor_id = inv.investor_id
    LEFT JOIN wdl_by_inv AS w ON w.investor_id = inv.investor_id
    WHERE greatest(
      0::numeric,
      least(
        coalesce(m.manual_total, 0)::numeric,
        coalesce(m.manual_total, 0)::numeric
          - (inv.balance_before - (coalesce(d.dep_total, 0) - coalesce(w.w_total, 0)))
      )
    ) > 0
  ),
  applied AS (
    UPDATE public.investors AS i
    SET
      balance = coalesce(i.balance, 0)::numeric + g.shortfall,
      withdrawable_profit = coalesce(i.withdrawable_profit, 0)::numeric + g.shortfall,
      total_profit = coalesce(i.total_profit, 0)::numeric + g.shortfall
    FROM gaps AS g
    WHERE i.id = g.investor_id
    RETURNING
      g.investor_id,
      g.email,
      g.shortfall,
      g.manual_total,
      g.net_principal,
      g.balance_before
  )
  SELECT * FROM applied;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_manual_profit_balance_gaps() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_manual_profit_balance_gaps() TO service_role;
