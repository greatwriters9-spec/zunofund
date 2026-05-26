-- P2P merchant marketplace (separate from exchange deposits / wallet withdrawals).
-- Merchants: merchant_profiles (admin-approved). Offers + orders + RPC state machine.
-- Deposits: skip_plan_amount_validation bypasses the $20 minimum for synthetic P2P credits.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.merchant_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  applied_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX merchant_profiles_status_idx ON public.merchant_profiles (status);

CREATE TABLE public.merchant_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id uuid NOT NULL REFERENCES public.merchant_profiles (user_id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('sell_usdt', 'buy_usdt')),
  payment_methods text[] NOT NULL DEFAULT '{}',
  min_limit numeric NOT NULL CHECK (min_limit >= 0),
  max_limit numeric NOT NULL CHECK (max_limit >= min_limit),
  rate_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  payment_instructions text,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX merchant_offers_side_status_idx
  ON public.merchant_offers (side, status);

CREATE INDEX merchant_offers_merchant_idx
  ON public.merchant_offers (merchant_user_id);

CREATE TABLE public.merchant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  merchant_user_id uuid NOT NULL REFERENCES public.merchant_profiles (user_id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.merchant_offers (id) ON DELETE RESTRICT,
  side text NOT NULL CHECK (side IN ('sell_usdt', 'buy_usdt')),
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  rate_percentage numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  usdt_credit_amount numeric,
  usdt_escrow_amount numeric,
  locked_take_from_profit numeric,
  locked_take_from_principal numeric,
  payment_method text NOT NULL DEFAULT '',
  proof_of_payment text,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'completed', 'cancelled')),
  expires_at timestamptz NOT NULL,
  deposit_id uuid REFERENCES public.deposits (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  CONSTRAINT merchant_orders_side_amounts_chk CHECK (
    (side = 'sell_usdt'
      AND usdt_credit_amount IS NOT NULL
      AND usdt_escrow_amount IS NULL
      AND locked_take_from_profit IS NULL
      AND locked_take_from_principal IS NULL)
    OR
    (side = 'buy_usdt'
      AND usdt_escrow_amount IS NOT NULL
      AND usdt_credit_amount IS NULL
      AND locked_take_from_profit IS NOT NULL
      AND locked_take_from_principal IS NOT NULL)
  )
);

CREATE INDEX merchant_orders_investor_idx ON public.merchant_orders (investor_user_id, status);
CREATE INDEX merchant_orders_merchant_idx ON public.merchant_orders (merchant_user_id, status);
CREATE INDEX merchant_orders_expires_idx ON public.merchant_orders (expires_at)
  WHERE status = 'pending_payment';

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS skip_plan_amount_validation boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Deposit validation: allow P2P synthetic rows to bypass $20 minimum
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'deposit requires user_id';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'deposit amount must be positive';
  END IF;

  SELECT count(*) INTO cnt
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  IF coalesce(NEW.skip_plan_amount_validation, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.amount::numeric < 20 THEN
    RAISE EXCEPTION
      'deposit amount must be at least 20 USD'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deposits_before_insert_validate_plan_range() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_profiles_select_own_admin_or_active
ON public.merchant_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR status = 'active'
);

CREATE POLICY merchant_profiles_insert_own_pending
ON public.merchant_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY merchant_profiles_update_admin
ON public.merchant_profiles FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY merchant_offers_select_authenticated
ON public.merchant_offers FOR SELECT TO authenticated
USING (
  status = 'active'
  OR merchant_user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY merchant_offers_insert_own_active_merchant
ON public.merchant_offers FOR INSERT TO authenticated
WITH CHECK (
  merchant_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = auth.uid() AND mp.status = 'active'
  )
);

CREATE POLICY merchant_offers_update_own
ON public.merchant_offers FOR UPDATE TO authenticated
USING (
  merchant_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = auth.uid() AND mp.status = 'active'
  )
)
WITH CHECK (
  merchant_user_id = auth.uid()
);

CREATE POLICY merchant_orders_select_parties
ON public.merchant_orders FOR SELECT TO authenticated
USING (
  investor_user_id = auth.uid()
  OR merchant_user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY merchant_orders_no_insert
ON public.merchant_orders FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY merchant_orders_no_update
ON public.merchant_orders FOR UPDATE TO authenticated
USING (false);

-- ---------------------------------------------------------------------------
-- Helpers & RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_merchant(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchant_profiles mp
    WHERE mp.user_id = check_uid
      AND mp.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_merchant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_merchant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_to_become_merchant(p_display_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  st text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT mp.status INTO st
  FROM public.merchant_profiles mp
  WHERE mp.user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.merchant_profiles (user_id, display_name, status)
    VALUES (
      auth.uid(),
      NULLIF(trim(coalesce(p_display_name, '')), ''),
      'pending'
    );
    RETURN;
  END IF;

  IF st = 'active' THEN
    RAISE EXCEPTION 'already an active merchant';
  END IF;

  IF st = 'pending' THEN
    RAISE EXCEPTION 'application already pending';
  END IF;

  IF st IN ('rejected', 'suspended') THEN
    UPDATE public.merchant_profiles mp
    SET
      status = 'pending',
      display_name = COALESCE(NULLIF(trim(coalesce(p_display_name, '')), ''), mp.display_name),
      applied_at = (NOW() AT TIME ZONE 'UTC'),
      reviewed_at = NULL,
      reviewed_by = NULL,
      review_note = NULL,
      updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mp.user_id = auth.uid();
    RETURN;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_to_become_merchant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_to_become_merchant(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_merchant_application(
  p_user_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.merchant_profiles mp
  SET
    status = CASE WHEN p_approve THEN 'active' ELSE 'rejected' END,
    reviewed_at = (NOW() AT TIME ZONE 'UTC'),
    reviewed_by = auth.uid(),
    review_note = NULLIF(trim(coalesce(p_note, '')), ''),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = p_user_id
    AND mp.status = 'pending';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'no pending application for that user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_merchant_application(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_merchant_application(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_create_offer(
  p_side text,
  p_payment_methods text[],
  p_min_limit numeric,
  p_max_limit numeric,
  p_rate_percentage numeric,
  p_payment_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  nid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  IF p_side NOT IN ('sell_usdt', 'buy_usdt') THEN
    RAISE EXCEPTION 'invalid side';
  END IF;

  IF p_min_limit IS NULL OR p_max_limit IS NULL OR p_min_limit < 0 OR p_max_limit < p_min_limit THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  INSERT INTO public.merchant_offers (
    merchant_user_id,
    side,
    payment_methods,
    min_limit,
    max_limit,
    rate_percentage,
    payment_instructions,
    status
  )
  VALUES (
    auth.uid(),
    p_side,
    coalesce(p_payment_methods, '{}'),
    p_min_limit,
    p_max_limit,
    coalesce(p_rate_percentage, 0),
    NULLIF(trim(coalesce(p_payment_instructions, '')), ''),
    'active'
  )
  RETURNING id INTO nid;

  RETURN nid;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_create_offer(text, text[], numeric, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_set_offer_status(p_offer_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  UPDATE public.merchant_offers o
  SET
    status = CASE WHEN p_active THEN 'active' ELSE 'inactive' END,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE o.id = p_offer_id
    AND o.merchant_user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'offer not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_set_offer_status(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_set_offer_status(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_search_merchant_offers(
  p_side text,
  p_amount numeric,
  p_payment_method text DEFAULT NULL
)
RETURNS TABLE (
  offer_id uuid,
  merchant_user_id uuid,
  merchant_display_name text,
  side text,
  payment_methods text[],
  min_limit numeric,
  max_limit numeric,
  rate_percentage numeric,
  payment_instructions text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.merchant_user_id,
    mp.display_name,
    o.side,
    o.payment_methods,
    o.min_limit,
    o.max_limit,
    o.rate_percentage,
    o.payment_instructions
  FROM public.merchant_offers AS o
  INNER JOIN public.merchant_profiles AS mp
    ON mp.user_id = o.merchant_user_id AND mp.status = 'active'
  WHERE o.status = 'active'
    AND o.side = p_side
    AND p_amount >= o.min_limit
    AND p_amount <= o.max_limit
    AND (
      p_payment_method IS NULL
      OR trim(p_payment_method) = ''
      OR p_payment_method = ANY (o.payment_methods)
    )
  ORDER BY o.rate_percentage ASC, o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_create_merchant_buy_order(
  p_offer_id uuid,
  p_amount_requested numeric,
  p_payment_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  off public.merchant_offers%ROWTYPE;
  fee numeric;
  credit numeric;
  oid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF off.status <> 'active' OR off.side <> 'sell_usdt' THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot place buy orders from investor flows';
  END IF;

  IF p_amount_requested IS NULL OR p_amount_requested <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  IF p_amount_requested < off.min_limit OR p_amount_requested > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN
    RAISE EXCEPTION 'payment method required';
  END IF;

  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  fee := round(p_amount_requested * (coalesce(off.rate_percentage, 0) / 100.0), 8);
  credit := round(p_amount_requested - fee, 8);

  IF credit <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive after fees';
  END IF;

  INSERT INTO public.merchant_orders (
    investor_user_id,
    merchant_user_id,
    offer_id,
    side,
    amount_requested,
    rate_percentage,
    fee_amount,
    usdt_credit_amount,
    payment_method,
    status,
    expires_at
  )
  VALUES (
    auth.uid(),
    off.merchant_user_id,
    off.id,
    'sell_usdt',
    p_amount_requested,
    off.rate_percentage,
    fee,
    credit,
    trim(p_payment_method),
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes'
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_buy_order(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_create_merchant_sell_order(
  p_offer_id uuid,
  p_usdt_amount numeric,
  p_payment_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  off public.merchant_offers%ROWTYPE;
  inv public.investors%ROWTYPE;
  take_from_profit numeric;
  take_from_principal numeric;
  remain numeric;
  amt numeric;
  oid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'merchants cannot open investor sell orders';
  END IF;

  SELECT * INTO off FROM public.merchant_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer not found';
  END IF;

  IF off.status <> 'active' OR off.side <> 'buy_usdt' THEN
    RAISE EXCEPTION 'invalid offer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_profiles mp
    WHERE mp.user_id = off.merchant_user_id AND mp.status = 'active'
  ) THEN
    RAISE EXCEPTION 'merchant inactive';
  END IF;

  amt := round(coalesce(p_usdt_amount, 0), 8);

  IF amt <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  IF amt < off.min_limit OR amt > off.max_limit THEN
    RAISE EXCEPTION 'amount outside offer limits';
  END IF;

  IF trim(coalesce(p_payment_method, '')) = '' THEN
    RAISE EXCEPTION 'payment method required';
  END IF;

  IF NOT (p_payment_method = ANY (off.payment_methods)) THEN
    RAISE EXCEPTION 'payment method not accepted by this offer';
  END IF;

  SELECT * INTO inv
  FROM public.investors
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  take_from_profit := LEAST(amt, coalesce(inv.withdrawable_profit, 0));
  remain := amt - take_from_profit;
  take_from_principal := LEAST(remain, coalesce(inv.withdrawable_principal, 0));

  IF take_from_profit + take_from_principal < amt THEN
    RAISE EXCEPTION 'insufficient withdrawable funds for this amount';
  END IF;

  UPDATE public.investors AS i
  SET
    balance = greatest(0::numeric, coalesce(i.balance, 0)::numeric - amt),
    withdrawable_profit = coalesce(i.withdrawable_profit, 0)::numeric - take_from_profit,
    withdrawable_principal = coalesce(i.withdrawable_principal, 0)::numeric - take_from_principal
  WHERE i.user_id = auth.uid();

  PERFORM public.sync_investment_plan_from_principal(auth.uid());

  INSERT INTO public.merchant_orders (
    investor_user_id,
    merchant_user_id,
    offer_id,
    side,
    amount_requested,
    rate_percentage,
    fee_amount,
    usdt_escrow_amount,
    locked_take_from_profit,
    locked_take_from_principal,
    payment_method,
    status,
    expires_at
  )
  VALUES (
    auth.uid(),
    off.merchant_user_id,
    off.id,
    'buy_usdt',
    amt,
    off.rate_percentage,
    0,
    amt,
    take_from_profit,
    take_from_principal,
    trim(p_payment_method),
    'pending_payment',
    (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 minutes'
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_create_merchant_sell_order(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_mark_merchant_order_paid(
  p_order_id uuid,
  p_proof text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.merchant_orders mo
  SET
    status = 'paid',
    proof_of_payment = NULLIF(trim(coalesce(p_proof, '')), ''),
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo.id = p_order_id
    AND mo.investor_user_id = auth.uid()
    AND mo.side = 'sell_usdt'
    AND mo.status = 'pending_payment'
    AND mo.expires_at > (NOW() AT TIME ZONE 'UTC');

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'order not updatable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_mark_merchant_order_paid(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_mark_merchant_order_paid(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_release_buy_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  inv_email text;
  dep_id uuid;
  bump numeric;
  until_ts timestamptz;
  sync_uid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.merchant_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.side <> 'sell_usdt' OR mo.status <> 'paid' THEN
    RAISE EXCEPTION 'invalid order state';
  END IF;

  bump := coalesce(mo.usdt_credit_amount, 0);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'invalid credit amount';
  END IF;

  SELECT lower(trim(coalesce(email, ''))) INTO inv_email
  FROM public.investors
  WHERE user_id = mo.investor_user_id;

  IF NOT FOUND OR inv_email IS NULL OR inv_email = '' THEN
    RAISE EXCEPTION 'investor email missing';
  END IF;

  INSERT INTO public.deposits (
    user_id,
    investor_email,
    amount,
    txid,
    payment_method,
    status,
    skip_plan_amount_validation
  )
  VALUES (
    mo.investor_user_id,
    inv_email,
    bump,
    'p2p:' || mo.id::text,
    'P2P_MERCHANT',
    'pending',
    true
  )
  RETURNING id INTO dep_id;

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = dep_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = mo.investor_user_id;

  until_ts := (NOW() AT TIME ZONE 'UTC') + INTERVAL '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until
  )
  VALUES (
    dep_id,
    mo.investor_user_id,
    inv_email,
    bump,
    until_ts
  );

  sync_uid := mo.investor_user_id;
  PERFORM public.sync_investment_plan_from_principal(sync_uid);

  UPDATE public.merchant_orders mo2
  SET
    status = 'completed',
    deposit_id = dep_id,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_release_buy_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_release_buy_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_confirm_merchant_sell_paid(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.merchant_orders mo
  SET
    status = 'completed',
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo.id = p_order_id
    AND mo.investor_user_id = auth.uid()
    AND mo.side = 'buy_usdt'
    AND mo.status = 'pending_payment';

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'order not updatable';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_confirm_merchant_sell_paid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_confirm_merchant_sell_paid(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._merchant_restore_sell_escrow(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt numeric;
BEGIN
  amt := coalesce(p_mo.usdt_escrow_amount, 0);
  IF amt <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + amt,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + coalesce(p_mo.locked_take_from_profit, 0),
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + coalesce(p_mo.locked_take_from_principal, 0)
  WHERE inv.user_id = p_mo.investor_user_id;

  PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public._merchant_restore_sell_escrow(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.investor_cancel_merchant_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.investor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'cannot cancel this order';
  END IF;

  IF mo.side = 'buy_usdt' THEN
    PERFORM public._merchant_restore_sell_escrow(mo);
  END IF;

  UPDATE public.merchant_orders mo2
  SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_cancel_merchant_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_cancel_merchant_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_cancel_merchant_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_merchant(auth.uid()) THEN
    RAISE EXCEPTION 'not an active merchant';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.merchant_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;

  IF mo.side = 'sell_usdt' AND mo.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'cannot cancel after investor marked paid; contact support';
  END IF;

  IF mo.status <> 'pending_payment' AND mo.status <> 'paid' THEN
    RAISE EXCEPTION 'cannot cancel this order';
  END IF;

  IF mo.side = 'buy_usdt' AND mo.status = 'pending_payment' THEN
    PERFORM public._merchant_restore_sell_escrow(mo);
  END IF;

  UPDATE public.merchant_orders mo2
  SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_cancel_merchant_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_cancel_merchant_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.merchant_expire_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer := 0;
  r public.merchant_orders%ROWTYPE;
BEGIN
  FOR r IN
    SELECT *
    FROM public.merchant_orders mo
    WHERE mo.status = 'pending_payment'
      AND mo.expires_at <= (NOW() AT TIME ZONE 'UTC')
    FOR UPDATE
  LOOP
    IF r.side = 'buy_usdt' THEN
      PERFORM public._merchant_restore_sell_escrow(r);
    END IF;

    UPDATE public.merchant_orders mo2
    SET status = 'cancelled', updated_at = (NOW() AT TIME ZONE 'UTC')
    WHERE mo2.id = r.id;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_expire_stale_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_expire_stale_orders() TO service_role;
