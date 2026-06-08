-- P2P dispute reopen: mark linked deposit disputed, remove funds from investor
-- spendable ledger immediately, restore or reverse on admin resolution.

CREATE OR REPLACE FUNCTION public._p2p_set_order_deposit_status(
  p_deposit_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF p_deposit_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.deposits AS dep
  SET
    status = p_status,
    admin_note = coalesce(nullif(trim(p_admin_note), ''), dep.admin_note)
  WHERE dep.id = p_deposit_id;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_set_order_deposit_status(uuid, text, text) FROM PUBLIC;

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
      AND dep.status IN ('approved', 'disputed', 'resolved');

    IF coalesce(dep_amt, 0) > 0 THEN
      RETURN dep_amt;
    END IF;
  END IF;

  IF coalesce(p_mo.dispute_hold_amount, 0) > 0 THEN
    RETURN p_mo.dispute_hold_amount;
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
        btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
        btc_withdrawable = greatest(
          0::numeric,
          coalesce(inv.btc_withdrawable, 0)::numeric - least(coalesce(inv.btc_withdrawable, 0), bump)
        )
      WHERE inv.user_id = hold_user;

      PERFORM public._p2p_set_order_deposit_status(
        p_mo.deposit_id,
        'disputed',
        format('P2P trade %s under admin dispute review', left(p_mo.id::text, 8))
      );

      PERFORM public.sync_investment_plan_from_principal(hold_user);
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

    UPDATE public.investors AS inv
    SET
      balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - bump
      )
    WHERE inv.user_id = hold_user;

    PERFORM public._p2p_set_order_deposit_status(
      p_mo.deposit_id,
      'disputed',
      format('P2P trade %s under admin dispute review', left(p_mo.id::text, 8))
    );

    PERFORM public.sync_investment_plan_from_principal(hold_user);
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
        btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
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

    UPDATE public.investors AS inv
    SET
      balance = greatest(0::numeric, coalesce(inv.balance, 0)::numeric - bump),
      locked_principal_balance = greatest(
        0::numeric,
        coalesce(inv.locked_principal_balance, 0)::numeric - bump
      )
    WHERE inv.user_id = hold_user;

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

    PERFORM public.sync_investment_plan_from_principal(hold_user);
    RETURN bump;
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_apply_dispute_balance_hold(public.merchant_orders) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._p2p_release_dispute_balance_hold(
  p_mo public.merchant_orders,
  p_deposit_status text DEFAULT 'resolved'
)
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
  final_dep_status text := coalesce(nullif(trim(p_deposit_status), ''), 'resolved');
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
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
        btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
      WHERE inv.user_id = hold_user;

      PERFORM public._p2p_set_order_deposit_status(
        p_mo.deposit_id,
        final_dep_status,
        'P2P dispute resolved in favor of investor'
      );
      PERFORM public.sync_investment_plan_from_principal(hold_user);
      RETURN;
    END IF;

    SELECT *
    INTO lock_rec
    FROM public.principal_locks AS pl
    WHERE pl.deposit_id = p_mo.deposit_id
      AND pl.lock_source = 'p2p_dispute'
    FOR UPDATE;

    UPDATE public.investors AS inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + bump,
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
    WHERE inv.user_id = hold_user;

    IF lock_rec.id IS NULL THEN
      PERFORM public._p2p_set_order_deposit_status(
        p_mo.deposit_id,
        final_dep_status,
        'P2P dispute resolved in favor of investor'
      );
      PERFORM public.sync_investment_plan_from_principal(hold_user);
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

    PERFORM public._p2p_set_order_deposit_status(
      p_mo.deposit_id,
      final_dep_status,
      'P2P dispute resolved in favor of investor'
    );
    PERFORM public.sync_investment_plan_from_principal(hold_user);
    RETURN;
  END IF;

  IF p_mo.side IN ('buy_usdt', 'buy_btc') THEN
    hold_user := p_mo.merchant_user_id;

    IF p_mo.side = 'buy_btc' THEN
      UPDATE public.investors AS inv
      SET
        btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
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
      balance = coalesce(inv.balance, 0)::numeric + bump,
      locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump,
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + bump
    WHERE inv.user_id = hold_user;

    PERFORM public.sync_investment_plan_from_principal(hold_user);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._p2p_release_dispute_balance_hold(public.merchant_orders, text) FROM PUBLIC;

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
  funds_already_held boolean;
BEGIN
  IF p_mo.side NOT IN ('sell_usdt', 'sell_btc') THEN
    RETURN;
  END IF;

  bump := public._p2p_dispute_hold_amount(p_mo);
  IF bump <= 0 THEN
    RAISE EXCEPTION 'nothing to claw back';
  END IF;

  funds_already_held := coalesce(p_mo.dispute_hold_applied, false);

  PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

  IF p_mo.side = 'sell_btc' THEN
    IF NOT funds_already_held THEN
      UPDATE public.investors AS inv
      SET
        btc_balance = greatest(0::numeric, coalesce(inv.btc_balance, 0)::numeric - bump),
        btc_withdrawable = greatest(0::numeric, coalesce(inv.btc_withdrawable, 0)::numeric - bump)
      WHERE inv.user_id = p_mo.investor_user_id;
    END IF;

    UPDATE public.investors AS inv
    SET
      btc_balance = coalesce(inv.btc_balance, 0)::numeric + bump,
      btc_withdrawable = coalesce(inv.btc_withdrawable, 0)::numeric + bump
    WHERE inv.user_id = p_mo.merchant_user_id;

    IF p_mo.deposit_id IS NOT NULL THEN
      PERFORM public._p2p_set_order_deposit_status(
        p_mo.deposit_id,
        'reversed',
        'P2P dispute resolved in favor of merchant'
      );
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO lock_rec
  FROM public.principal_locks AS pl
  WHERE pl.deposit_id = p_mo.deposit_id
  FOR UPDATE;

  IF NOT funds_already_held THEN
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
  END IF;

  IF lock_rec.id IS NOT NULL THEN
    DELETE FROM public.principal_locks AS pl WHERE pl.id = lock_rec.id;
  END IF;

  IF p_mo.deposit_id IS NOT NULL THEN
    UPDATE public.deposits AS dep
    SET
      status = 'reversed',
      reversed_at = (NOW() AT TIME ZONE 'UTC'),
      admin_note = coalesce(dep.admin_note, 'P2P dispute resolved in favor of merchant')
    WHERE dep.id = p_mo.deposit_id
      AND dep.status IN ('approved', 'disputed', 'resolved');
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

-- Backfill active reopened disputes that still show approved deposits / full balances.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT mo.*
    FROM public.merchant_orders AS mo
    WHERE mo.status = 'disputed'
      AND coalesce(mo.dispute_hold_applied, false)
      AND mo.deposit_id IS NOT NULL
  LOOP
    PERFORM set_config('app.tp_allow_investor_ledger_mutation', '1', true);

    UPDATE public.deposits AS dep
    SET
      status = 'disputed',
      admin_note = coalesce(
        dep.admin_note,
        format('P2P trade %s under admin dispute review', left(rec.id::text, 8))
      )
    WHERE dep.id = rec.deposit_id
      AND dep.status = 'approved';

    IF rec.side IN ('sell_usdt', 'sell_btc') AND rec.side = 'sell_usdt' THEN
      UPDATE public.investors AS inv
      SET
        balance = greatest(
          0::numeric,
          coalesce(inv.balance, 0)::numeric - coalesce(rec.dispute_hold_amount, 0)
        ),
        locked_principal_balance = greatest(
          0::numeric,
          coalesce(inv.locked_principal_balance, 0)::numeric - coalesce(rec.dispute_hold_amount, 0)
        )
      WHERE inv.user_id = rec.investor_user_id
        AND coalesce(inv.balance, 0) >= coalesce(rec.dispute_hold_amount, 0);

      PERFORM public.sync_investment_plan_from_principal(rec.investor_user_id);
    END IF;
  END LOOP;
END;
$$;
