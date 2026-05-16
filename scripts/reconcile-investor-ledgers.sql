-- Investor ledger reconciliation (run in Supabase SQL Editor or psql).
-- Expect: no rows from sections 1–2; section 4 is informational.

-- 1) NAV identity: balance should equal locked principal + withdrawable.
SELECT
  i.id,
  i.email,
  coalesce(i.balance, 0) AS balance,
  coalesce(i.locked_principal_balance, 0) AS locked,
  coalesce(i.withdrawable_balance, 0) AS withdrawable,
  coalesce(i.balance, 0)
    - (coalesce(i.locked_principal_balance, 0) + coalesce(i.withdrawable_balance, 0)) AS gap
FROM public.investors i
WHERE ABS(
  coalesce(i.balance, 0)
    - (coalesce(i.locked_principal_balance, 0) + coalesce(i.withdrawable_balance, 0))
) > 0.01;

-- 2) Column "locked_principal_balance" vs sum of IMMATURE principal_lock rows (by user_id).
WITH pl AS (
  SELECT
    user_id,
    SUM(principal_amount) FILTER (WHERE NOT matured)::numeric AS immature_from_locks,
    COUNT(*) FILTER (WHERE NOT matured)::int AS open_lock_rows
  FROM public.principal_locks
  WHERE user_id IS NOT NULL
  GROUP BY user_id
)
SELECT
  i.email,
  coalesce(i.locked_principal_balance, 0)::numeric AS locked_col,
  coalesce(pl.immature_from_locks, 0) AS locks_open_sum,
  coalesce(pl.open_lock_rows, 0) AS open_lock_rows,
  coalesce(i.locked_principal_balance, 0) - coalesce(pl.immature_from_locks, 0) AS gap
FROM public.investors i
LEFT JOIN pl ON pl.user_id = i.user_id
WHERE i.user_id IS NOT NULL
  AND ABS(coalesce(i.locked_principal_balance, 0) - coalesce(pl.immature_from_locks, 0)) > 0.02;

-- 3) Deposits funnel (counts & totals by status).
SELECT status, COUNT(*), ROUND(SUM(amount::numeric), 2) AS total_amount
FROM public.deposits
GROUP BY status
ORDER BY status;

-- 4) Open principal locks nearing maturity (next 10).
SELECT investor_email,
       principal_amount,
       locked_until,
       ROUND(EXTRACT(epoch FROM (locked_until - now())) / 86400.0, 1) AS days_remaining
FROM public.principal_locks
WHERE NOT matured
ORDER BY locked_until
LIMIT 10;
