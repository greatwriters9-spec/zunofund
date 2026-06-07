-- Remove legacy deposit notification that concatenated raw numeric amounts
-- (e.g. $1999.00000000) and wire the formatted tp_notify_deposit_approved trigger.

DROP TRIGGER IF EXISTS deposit_notification_trigger ON public.deposits;
DROP FUNCTION IF EXISTS public.notify_deposit_approved();

CREATE OR REPLACE FUNCTION public._format_money_display(p_amount numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(round(coalesce(p_amount, 0)::numeric, 2), 'FM999999999999990.00');
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
    format(
      'Your deposit of $%s was approved. Use it on P2P anytime; crypto wallet principal withdrawals unlock after 30 days.',
      amt
    ),
    'deposit_approved'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tp_notify_deposit_approved_row() FROM PUBLIC;

DROP TRIGGER IF EXISTS tp_notify_deposit_approved ON public.deposits;
CREATE TRIGGER tp_notify_deposit_approved
AFTER UPDATE ON public.deposits
FOR EACH ROW
EXECUTE PROCEDURE public.tp_notify_deposit_approved_row();
