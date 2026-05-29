-- Money in notifications/emails: min 2, max 4 decimal places (withdrawals, deposits, etc.).

CREATE OR REPLACE FUNCTION public._format_money_display(p_amount numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r numeric;
  whole text;
  frac text;
BEGIN
  r := round(coalesce(p_amount, 0)::numeric, 4);

  IF r < 0 THEN
    RETURN '-' || public._format_money_display(abs(r));
  END IF;

  whole := trunc(r)::text;
  frac := ltrim(to_char(abs(r - trunc(r)), 'FM0.9999'), '0.');

  IF frac = '' OR length(frac) < 2 THEN
    frac := lpad(coalesce(nullif(frac, ''), '0'), 2, '0');
  END IF;

  IF length(frac) > 4 THEN
    frac := left(frac, 4);
  END IF;

  WHILE length(frac) > 2 AND right(frac, 1) = '0' LOOP
    frac := left(frac, length(frac) - 1);
  END LOOP;

  RETURN whole || '.' || frac;
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
    IF NEW.status IS DISTINCT FROM 'approved' THEN
      RETURN NEW;
    END IF;

    PERFORM public.tp_emit_investor_notification(
      NEW.user_id,
      NEW.investor_email,
      'Withdrawal completed',
      format(
        'Your P2P withdrawal for $%s USDT was completed. Funds were settled to the merchant as agreed.',
        amt
      ),
      'withdrawal_approved'
    );

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
