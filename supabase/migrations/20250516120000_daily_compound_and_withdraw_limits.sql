-- Daily compounded profit per plan + 30-day principal lock per approved deposit + withdrawal caps.
-- Post-deploy: schedule `SELECT public.run_daily_investment_jobs();` ~once per 24h (pg_cron, Edge Function, etc.).

-- --- Investor ledger columns ---
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS locked_principal_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawable_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_compound_at timestamptz;

-- --- Principal lock tranches (one row per approved deposit) ---
CREATE TABLE IF NOT EXISTS public.principal_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.deposits (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  investor_email text NOT NULL,
  principal_amount numeric NOT NULL CHECK (principal_amount >= 0),
  locked_until timestamptz NOT NULL,
  matured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deposit_id)
);

CREATE INDEX IF NOT EXISTS principal_locks_user_maturity_idx
  ON public.principal_locks (user_id, matured, locked_until);

ALTER TABLE public.principal_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY principal_locks_select_own_or_admin
ON public.principal_locks
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

-- Withdrawals: link to auth user for dashboard filters + policies
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- Backfill withdrawable / locked for investors with no locks (now that table exists)
UPDATE public.investors inv
SET
  withdrawable_balance = COALESCE(inv.balance, 0),
  locked_principal_balance = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.principal_locks pl WHERE pl.user_id = inv.user_id
);

-- --- Block non-admins from editing ledger columns (extend existing trigger) ---
CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.balance := OLD.balance;
      NEW.total_profit := OLD.total_profit;
      NEW.locked_principal_balance := OLD.locked_principal_balance;
      NEW.withdrawable_balance := OLD.withdrawable_balance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- --- Plan → daily compound % (order: elite > growth > pro > starter) ---
CREATE OR REPLACE FUNCTION public.daily_compound_percent_for_plan(plan text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%elite%' THEN 15::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%growth%' THEN 7::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%pro%' THEN 10::numeric
    WHEN lower(trim(coalesce(plan, ''))) LIKE '%starter%' THEN 5::numeric
    ELSE 5::numeric
  END;
$$;

REVOKE ALL ON FUNCTION public.daily_compound_percent_for_plan(text) FROM PUBLIC;

-- Unlock matured principal slices (locked → withdrawable; total balance unchanged).
CREATE OR REPLACE FUNCTION public.mature_principal_locks(p_now timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT *
    FROM public.principal_locks
    WHERE matured = false
      AND locked_until <= p_now
    ORDER BY locked_until
    FOR UPDATE
  LOOP
    UPDATE public.principal_locks AS pl
    SET matured = true
    WHERE pl.id = rec.id;

    UPDATE public.investors AS inv
    SET
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - rec.principal_amount::numeric
      ),
      withdrawable_balance = coalesce(inv.withdrawable_balance, 0)::numeric + rec.principal_amount::numeric
    WHERE inv.user_id = rec.user_id
       OR lower(trim(inv.email)) = lower(trim(rec.investor_email));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;

-- Applies one daily compound accrual per investor (~24h since last_compound_at).
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
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.run_daily_investment_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.mature_principal_locks(NOW());
  PERFORM public.apply_daily_compound_interest();
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_investment_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_investment_jobs() TO service_role;

-- Postgres forbids renaming RPC parameters via CREATE OR REPLACE; drop legacy signatures first.
DROP FUNCTION IF EXISTS public.approve_deposit(uuid);

-- --- Approve deposit: credit NAV + locked principal slice + principal_lock row ---
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric := 0;
  until_ts timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit not found';
  END IF;

  IF d.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  bump := coalesce(d.amount::numeric, 0);

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = p_deposit_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until
  )
  VALUES (
    p_deposit_id,
    d.user_id,
    coalesce(trim(d.investor_email), ''),
    bump,
    until_ts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- --- Withdrawal validation (pending requests reduce available headroom) ---
CREATE OR REPLACE FUNCTION public.withdrawals_before_insert_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inv_row public.investors%ROWTYPE;
  pending_sum numeric := 0;
  avail numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new withdrawals must start as pending';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'invalid withdrawal amount';
  END IF;

  NEW.user_id := uid;

  SELECT *
  INTO inv_row
  FROM public.investors
  WHERE user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  IF lower(trim(coalesce(NEW.investor_email, ''))) IS DISTINCT FROM lower(trim(coalesce(inv_row.email, ''))) THEN
    RAISE EXCEPTION 'email mismatch for withdrawal';
  END IF;

  SELECT COALESCE(sum(w.amount::numeric), 0)
  INTO pending_sum
  FROM public.withdrawals w
  WHERE w.user_id = uid
    AND w.status = 'pending';

  avail := COALESCE(inv_row.withdrawable_balance, 0)::numeric;

  IF NEW.amount::numeric + pending_sum > avail THEN
    RAISE EXCEPTION
      USING errcode = 'check_violation',
        message = 'withdrawal exceeds available withdrawable funds (principal unlocks after 30 days per deposit; profits accrue separately)',
        hint = format('withdrawable_balance=%s, pending_withdrawals_total=%s', avail, pending_sum);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS withdrawals_validate_before_insert ON public.withdrawals;
CREATE TRIGGER withdrawals_validate_before_insert
BEFORE INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE PROCEDURE public.withdrawals_before_insert_validate();

-- --- Approve withdrawal: deduct from withdrawable NAV ---
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  amt numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  IF w.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  amt := coalesce(w.amount::numeric, 0);

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - amt),
    withdrawable_balance = greatest(0::numeric, coalesce(inv.withdrawable_balance, 0)::numeric - amt)
  WHERE inv.user_id = w.user_id
     OR lower(trim(inv.email)) = lower(trim(w.investor_email));

  UPDATE public.withdrawals
  SET status = 'approved'
  WHERE id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- Tighter insert policy including user linkage
DROP POLICY IF EXISTS withdrawals_insert_own ON public.withdrawals;
CREATE POLICY withdrawals_insert_own
ON public.withdrawals
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);
