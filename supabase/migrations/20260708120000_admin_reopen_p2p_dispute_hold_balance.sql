-- Admin can reopen a completed P2P trade into dispute and hold released crypto
-- until an admin rules (e.g. merchant released coins but investor never paid fiat).

ALTER TABLE public.merchant_orders
  ADD COLUMN IF NOT EXISTS dispute_reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_hold_amount numeric,
  ADD COLUMN IF NOT EXISTS dispute_hold_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._p2p_dispute_hold_amount(p_mo public.merchant_orders)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  dep_amt numeric;
BEGIN
  IF p_mo.deposit_id IS NOT NULL THEN
    SELECT coalesce(dep.amount, 0)::numeric
    INTO dep_amt
    FROM public.deposits AS dep
    WHERE dep.id = p_mo.deposit_id
      AND dep.status = 'approved';

    IF coalesce(dep_amt, 0) > 0 THEN
      RETURN dep_amt;
    END IF;
  END IF;

  IF p_mo.side IN ('sell_usdt', 'sell_btc') THEN
    IF p_mo.side = 'sell_btc' THEN
      RETURN coalesce(p_mo.btc_credit_amount, 0)::numeric;
    END IF;
    RETURN public._p2p_order_usdt_credit(p_mo);
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    IF p_mo.side = 'buy_btc' THEN
      RETURN coalesce(p_mo.btc_escrow_amount, 0)::numeric;
    END IF;
    RETURN coalesce(p_mo.usdt_escrow_amount, 0)::numeric;
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_dispute_hold_amount(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_apply_dispute_balance_hold(p_mo public.merchant_orders)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  hold_user uuid;
  hold_email text;
  lock_rec public.principal_locks%ROWTYPE;
  move_amt numeric;
  avail_withdrawable numeric;
BEGIN
  bump := public._p2p_dispute_hold_amount(p_mo);
  IF bump <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  IF p_mo.side IN ('sell_usdt', 'sell_btc') THEN
    hold_user := p_mo.investor_user_id;

    SELECT lower(trim(coalesce(email, '')))
    INTO hold_email
    FROM public.investors
    WHERE user_id = hold_user;

    IF coalesce(hold_email, '') = '' THEN
      RAISE EXCEPTION 'investor email missing for dispute hold';
    END IF;

    IF p_mo.side = 'sell_btc' THEN
      UPDATE public.investors AS inv
      SET
        btc_withdrawable = greatest(
          0::numeric,
          coalesce(inv.btc_withdrawable, 0)::numeric - least(coalesce(inv.btc_withdrawable, 0), bump)
        )
      WHERE inv.user_id = hold_user;
      RETURN bump;
    END IF;

    SELECT *
    INTO lock_rec
    FROM public.principal_locks AS pl
    WHERE pl.deposit_id = p_mo.deposit_id
    FOR UPDATE;

    IF lock_rec.id IS NOT NULL THEN
      IF lock_rec.matured THEN
        SELECT coalesce(inv.withdrawable_principal, 0)::numeric
        INTO avail_withdrawable
        FROM public.investors AS inv
        WHERE inv.user_id = hold_user;

        move_amt := least(bump, coalesce(avail_withdrawable, 0));

        IF move_amt > 0 THEN
          UPDATE public.investors AS inv
          SET
            withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - move_amt,
            locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + move_amt
          WHERE inv.user_id = hold_user;
        END IF;

        UPDATE public.principal_locks AS pl
        SET
          matured = false,
          lock_source = 'p2p_dispute',
          locked_until = '9999-12-31 23:59:59+00'::timestamptz,
          principal_amount = bump
        WHERE pl.id = lock_rec.id;
      ELSE
        UPDATE public.principal_locks AS pl
        SET
          lock_source = 'p2p_dispute',
          locked_until = '9999-12-31 23:59:59+00'::timestamptz
        WHERE pl.id = lock_rec.id;
      END IF;
    ELSE
      SELECT coalesce(inv.withdrawable_principal, 0)::numeric
      INTO avail_withdrawable
      FROM public.investors AS inv
      WHERE inv.user_id = hold_user;

      move_amt := least(bump, coalesce(avail_withdrawable, 0));

      IF move_amt > 0 THEN
        UPDATE public.investors AS inv
        SET
          withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric - move_amt,
          locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + move_amt
        WHERE inv.user_id = hold_user;
      END IF;

      INSERT INTO public.principal_locks (
        deposit_id,
        user_id,
        investor_email,
        principal_amount,
        locked_until,
        lock_source
      )
      VALUES (
        p_mo.deposit_id,
        hold_user,
        hold_email,
        bump,
        '9999-12-31 23:59:59+00'::timestamptz,
        'p2p_dispute'
      );
    END IF;

    RETURN bump;
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    hold_user := p_mo.merchant_user_id;

    SELECT lower(trim(coalesce(email, '')))
    INTO hold_email
    FROM public.investors
    WHERE user_id = hold_user;

    IF coalesce(hold_email, '') = '' THEN
      RAISE EXCEPTION 'merchant investor email missing for dispute hold';
    END IF;

    IF p_mo.side = 'buy_btc' THEN
      UPDATE public.investors AS inv
      SET
        btc_withdrawable = greatest(
          0::numeric,
          coalesce(inv.btc_withdrawable, 0)::numeric - least(coalesce(inv.btc_withdrawable, 0), bump)
        )
      WHERE inv.user_id = hold_user;
      RETURN bump;
    END IF;

    SELECT coalesce(inv.withdrawable_profit, 0)::numeric
    INTO avail_withdrawable
    FROM public.investors AS inv
    WHERE inv.user_id = hold_user;

    move_amt := least(bump, coalesce(avail_withdrawable, 0));

    IF move_amt > 0 THEN
      UPDATE public.investors AS inv
      SET
        withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric - move_amt,
        locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + move_amt
      WHERE inv.user_id = hold_user;
    END IF;

    INSERT INTO public.principal_locks (
      user_id,
      investor_email,
      principal_amount,
      locked_until,
      lock_source
    )
    VALUES (
      hold_user,
      hold_email,
      bump,
      '9999-12-31 23:59:59+00'::timestamptz,
      'p2p_dispute'
    );

    RETURN bump;
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_apply_dispute_balance_hold(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_release_dispute_balance_hold(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  hold_user uuid;
  lock_rec public.principal_locks%ROWTYPE;
  dep_created timestamptz;
  restore_until timestamptz;
BEGIN
  bump := coalesce(p_mo.dispute_hold_amount, public._p2p_dispute_hold_amount(p_mo));
  IF bump <= 0 OR NOT coalesce(p_mo.dispute_hold_applied, false) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  IF p_mo.side IN ('sell_usdt', 'sell_btc') THEN
    hold_user := p_mo.investor_user_id;

    IF p_mo.side = 'sell_btc' THEN
      UPDATE public.investors AS inv
      SET
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = hold_user;
      RETURN;
    END IF;

    SELECT *
    INTO lock_rec
    FROM public.principal_locks AS pl
    WHERE pl.deposit_id = p_mo.deposit_id
      AND pl.lock_source = 'p2p_dispute'
    FOR UPDATE;

    IF lock_rec.id IS NULL THEN
      RETURN;
    END IF;

    SELECT dep.created_at
    INTO dep_created
    FROM public.deposits AS dep
    WHERE dep.id = p_mo.deposit_id;

    restore_until := coalesce(dep_created, (NOW() AT TIME ZONE 'UTC')) + INTERVAL '30 days';

    IF restore_until <= (NOW() AT TIME ZONE 'UTC') THEN
      UPDATE public.principal_locks AS pl
      SET matured = true, lock_source = 'deposit'
      WHERE pl.id = lock_rec.id;

      UPDATE public.investors AS inv
      SET
        locked_principal_balance = greatest(
          0::numeric,
          coalesce(inv.locked_principal_balance, 0)::numeric - bump
        ),
        withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + bump
      WHERE inv.user_id = hold_user;
    ELSE
      UPDATE public.principal_locks AS pl
      SET
        lock_source = 'deposit',
        locked_until = restore_until,
        matured = false
      WHERE pl.id = lock_rec.id;
    END IF;

    RETURN;
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    hold_user := p_mo.merchant_user_id;

    IF p_mo.side = 'buy_btc' THEN
      UPDATE public.investors AS inv
      SET
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = hold_user;
      RETURN;
    END IF;

    DELETE FROM public.principal_locks AS pl
    WHERE pl.user_id = hold_user
      AND pl.lock_source = 'p2p_dispute'
      AND pl.deposit_id IS NULL
      AND pl.principal_amount = bump;

    UPDATE public.investors AS inv
    SET
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - bump
      ),
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
    WHERE inv.user_id = hold_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_release_dispute_balance_hold(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_clawback_completed_sell_credit(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  from_locked numeric := 0;
  from_withdrawable numeric := 0;
  lock_rec public.principal_locks%ROWTYPE;
  n integer;
BEGIN
  IF p_mo.side NOT IN ('sell_usdt', 'sell_btc') THEN
    RETURN;
  END IF;

  bump := public._p2p_dispute_hold_amount(p_mo);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'nothing to claw back';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  IF p_mo.side = 'sell_btc' THEN
    UPDATE public.investors AS inv
    SET
      btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
      btc_withdrawable = greatest(0::numeric, coalesce(inv.btc_withdrawable, 0)::numeric - bump)
    WHERE inv.user_id = p_mo.investor_user_id;

    UPDATE public.investors AS inv
    SET
      btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
      btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
    WHERE inv.user_id = p_mo.merchant_user_id;

    RETURN;
  END IF;

  SELECT *
  INTO lock_rec
  FROM public.principal_locks AS pl
  WHERE pl.deposit_id = p_mo.deposit_id
  FOR UPDATE;

  IF lock_rec.id IS NOT NULL AND lock_rec.matured THEN
    from_withdrawable := bump;
  ELSE
    from_locked := bump;
  END IF;

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
    locked_principal_balance = greatest(
      0::numeric,
      coalesce(inv.locked_principal_balance, 0)::numeric - from_locked
    ),
    withdrawable_principal = greatest(
      0::numeric,
      coalesce(inv.withdrawable_principal, 0)::numeric - from_withdrawable
    )
  WHERE inv.user_id = p_mo.investor_user_id;

  IF lock_rec.id IS NOT NULL THEN
    DELETE FROM public.principal_locks AS pl WHERE pl.id = lock_rec.id;
  END IF;

  IF p_mo.deposit_id IS NOT NULL THEN
    UPDATE public.deposits AS dep
    SET
      status = 'reversed',
      reversed_at = (NOW() AT TIME ZONE 'UTC')
    WHERE dep.id = p_mo.deposit_id
      AND dep.status = 'approved';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
  WHERE inv.user_id = p_mo.merchant_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant investor profile not found';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(p_mo.merchant_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_clawback_completed_sell_credit(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_clawback_completed_buy_to_investor(p_mo public.merchant_orders)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  bump numeric;
  n integer;
BEGIN
  IF p_mo.side NOT IN ('buy_usdt', 'buy_btc') THEN
    RETURN;
  END IF;

  bump := public._p2p_dispute_hold_amount(p_mo);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'nothing to claw back';
  END IF;

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  IF p_mo.side = 'buy_btc' THEN
    UPDATE public.investors AS inv
    SET
      btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
      btc_withdrawable = greatest(0::numeric, coalesce(inv.btc_withdrawable, 0)::numeric - bump)
    WHERE inv.user_id = p_mo.merchant_user_id;

    UPDATE public.investors AS inv
    SET
      btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
      btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
    WHERE inv.user_id = p_mo.investor_user_id;

    RETURN;
  END IF;

  DELETE FROM public.principal_locks AS pl
  WHERE pl.user_id = p_mo.merchant_user_id
    AND pl.lock_source = 'p2p_dispute'
    AND pl.deposit_id IS NULL
    AND pl.principal_amount = bump;

  UPDATE public.investors AS inv
  SET
    balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
    locked_principal_balance = greatest(
      0::numeric,
      coalesce(inv.locked_principal_balance, 0)::numeric - bump
    ),
    withdrawable_profit = greatest(
      0::numeric,
      coalesce(inv.withdrawable_profit, 0)::numeric - least(coalesce(inv.withdrawable_profit, 0), bump)
    )
  WHERE inv.user_id = p_mo.merchant_user_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + coalesce(p_mo.locked_take_from_profit, 0),
    withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + coalesce(p_mo.locked_take_from_principal, 0)
  WHERE inv.user_id = p_mo.investor_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'investor profile not found';
  END IF;

  PERFORM public.sync_investment_plan_from_principal(p_mo.merchant_user_id);
  PERFORM public.sync_investment_plan_from_principal(p_mo.investor_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_clawback_completed_buy_to_investor(public.merchant_orders) FROM PUBLIC;

-- Skip admin dispute holds during principal maturity cron
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
      AND coalesce(lock_source, 'deposit') <> 'p2p_dispute'
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
      withdrawable_principal = coalesce(inv.withdrawable_principal, 0)::numeric + rec.principal_amount::numeric
    WHERE inv.user_id = rec.user_id
       OR lower(trim(inv.email)) = lower(trim(rec.investor_email));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.mature_principal_locks(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mature_principal_locks(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Admin reopen completed trade → dispute + hold
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reopen_merchant_order_dispute(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  reason_trim text;
  hold_amt numeric;
  order_short text;
  was_completed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  reason_trim := left(trim(coalesce(p_reason, '')), 500);
  IF length(reason_trim) < 3 THEN
    RAISE EXCEPTION 'dispute reason required (min 3 characters)';
  END IF;

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.status NOT IN ('completed', 'paid') THEN
    RAISE EXCEPTION 'only completed or paid trades can be reopened by admin';
  END IF;

  was_completed := mo.status = 'completed';

  hold_amt := 0;
  IF was_completed THEN
    hold_amt := public._p2p_apply_dispute_balance_hold(mo);
  END IF;

  UPDATE public.merchant_orders AS mo2
  SET
    status = 'disputed',
    dispute_reason = reason_trim,
    dispute_opened_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_opened_by = auth.uid(),
    dispute_reopened_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_resolved_at = NULL,
    dispute_winner = NULL,
    dispute_resolved_by = NULL,
    dispute_hold_amount = CASE WHEN hold_amt > 0 THEN hold_amt ELSE NULL END,
    dispute_hold_applied = hold_amt > 0,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;

  order_short := left(mo.id::text, 8);

  PERFORM public.tp_emit_admin_notification(
    'P2P dispute reopened by admin',
    format(
      'Trade #%s reopened into dispute. %s USDT held pending review. Reason: %s',
      order_short,
      coalesce(hold_amt, 0)::text,
      reason_trim
    ),
    'p2p_dispute'
  );

  INSERT INTO public.merchant_order_messages (
    order_id, sender_user_id, body, sender_role
  )
  VALUES (
    mo.id,
    auth.uid(),
    format(
      'Admin reopened this trade into dispute.%s Reason: %s',
      CASE
        WHEN hold_amt > 0 THEN format(E'\nOn-platform crypto hold: %s USDT.', trim(to_char(hold_amt, 'FM999999990.00')))
        ELSE ''
      END,
      reason_trim
    ),
    'system'
  );

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.investor_user_id,
    coalesce(i.email, ''),
    'Trade disputed by admin',
    'An admin reopened this trade for review. Chat here and wait for a ruling.',
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.investor_user_id;

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.merchant_user_id,
    coalesce(i.email, ''),
    'Trade disputed by admin',
    'An admin reopened this trade for review. Chat here and wait for a ruling.',
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.merchant_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reopen_merchant_order_dispute(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reopen_merchant_order_dispute(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Resolve dispute — handle reopened completed trades with balance holds
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_merchant_order_dispute(
  p_order_id uuid,
  p_winner text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  mo public.merchant_orders%ROWTYPE;
  winner text;
  final_status text;
  note_trim text;
  reopened_completed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  winner := lower(trim(coalesce(p_winner, '')));
  IF winner NOT IN ('investor', 'merchant') THEN
    RAISE EXCEPTION 'winner must be investor or merchant';
  END IF;

  note_trim := left(trim(coalesce(p_admin_note, '')), 500);

  SELECT * INTO mo FROM public.merchant_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF mo.status <> 'disputed' THEN
    RAISE EXCEPTION 'order is not in dispute';
  END IF;

  reopened_completed := coalesce(mo.dispute_reopened_at IS NOT NULL, false)
    AND coalesce(mo.dispute_hold_applied, false);

  IF reopened_completed THEN
    IF winner = 'investor' THEN
      IF mo.side IN ('sell_usdt', 'sell_btc') THEN
        PERFORM public._p2p_release_dispute_balance_hold(mo);
        final_status := 'completed';
      ELSIF mo.side IN ('buy_usdt', 'buy_btc') THEN
        PERFORM public._p2p_clawback_completed_buy_to_investor(mo);
        PERFORM public._p2p_release_dispute_balance_hold(mo);
        final_status := 'cancelled';
      ELSE
        RAISE EXCEPTION 'unsupported order side';
      END IF;
    ELSE
      IF mo.side IN ('sell_usdt', 'sell_btc') THEN
        PERFORM public._p2p_clawback_completed_sell_credit(mo);
        final_status := 'cancelled';
      ELSIF mo.side IN ('buy_usdt', 'buy_btc') THEN
        PERFORM public._p2p_release_dispute_balance_hold(mo);
        final_status := 'completed';
      ELSE
        RAISE EXCEPTION 'unsupported order side';
      END IF;
    END IF;
  ELSE
    IF winner = 'investor' THEN
      PERFORM public._p2p_dispute_release_crypto_to_investor(mo);
      final_status := CASE
        WHEN mo.side IN ('sell_usdt', 'sell_btc') THEN 'completed'
        ELSE 'cancelled'
      END;
    ELSE
      PERFORM public._p2p_dispute_release_crypto_to_merchant(mo);
      final_status := CASE
        WHEN mo.side IN ('buy_usdt', 'buy_btc') THEN 'completed'
        ELSE 'cancelled'
      END;
    END IF;
  END IF;

  UPDATE public.merchant_orders AS mo2
  SET
    status = final_status,
    dispute_winner = winner,
    dispute_resolved_at = (NOW() AT TIME ZONE 'UTC'),
    dispute_resolved_by = auth.uid(),
    dispute_hold_applied = false,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mo2.id = mo.id;

  INSERT INTO public.merchant_order_messages (
    order_id, sender_user_id, body, sender_role
  )
  VALUES (
    mo.id,
    auth.uid(),
    format(
      'Admin resolved dispute in favor of %s.%s',
      winner,
      CASE WHEN note_trim <> '' THEN E'\n' || note_trim ELSE '' END
    ),
    'system'
  );

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.investor_user_id,
    coalesce(i.email, ''),
    'Dispute resolved',
    format('Admin ruled in favor of the %s.', winner),
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.investor_user_id;

  INSERT INTO public.notifications (user_id, investor_email, title, message, type, is_read)
  SELECT
    mo.merchant_user_id,
    coalesce(i.email, ''),
    'Dispute resolved',
    format('Admin ruled in favor of the %s.', winner),
    'p2p_dispute',
    false
  FROM public.investors i
  WHERE i.user_id = mo.merchant_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_merchant_order_dispute(uuid, text, text) TO authenticated;
