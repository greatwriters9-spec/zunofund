CREATE OR REPLACE FUNCTION public._format_money_display(p_amount numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(round(coalesce(p_amount, 0)::numeric, 2), 'FM999999999999990.00');
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_profit_row_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt_bonus text := public._format_money_display(NEW.amount);
  amt_cmp text := public._format_money_display(NEW.amount);
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

CREATE OR REPLACE FUNCTION public.tp_notify_deposit_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit request received',
    format('We received your deposit request for $%s. Funds will show in your vault after approval.', amt),
    'deposit_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending deposit',
    format('%s requested a deposit for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_deposit'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_deposit_approved_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Deposit approved',
    format('Your deposit of $%s was approved and is now securing your tier lock (30‑day maturity).', amt),
    'deposit_approved'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF NEW.merchant_order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal submitted',
    format('We received your withdrawal request for $%s. Our team will review it shortly.', amt),
    'withdrawal_submitted'
  );

  PERFORM public.tp_emit_admin_notification(
    'Pending withdrawal',
    format('%s requested a withdrawal for $%s.', lower(trim(coalesce(NEW.investor_email, ''))), amt),
    'pending_withdrawal'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_withdrawal_approved_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := public._format_money_display(NEW.amount);
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Withdrawal completed',
    format('Your withdrawal for $%s was approved.', amt),
    'withdrawal_approved'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_principal_lock_unlocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt text := public._format_money_display(NEW.principal_amount);
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.matured IS NOT DISTINCT FROM NEW.matured THEN
    RETURN NEW;
  END IF;

  IF NEW.matured IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    NEW.user_id,
    NEW.investor_email,
    'Principal unlocked',
    format('$%s matured from locked principal is now withdrawable.', amt),
    'principal_unlocked'
  );

  RETURN NEW;
END;
$$;
