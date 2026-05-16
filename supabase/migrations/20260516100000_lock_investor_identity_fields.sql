-- Investors may update contact/profile fields only; tier, linkage, and system columns stay admin-controlled.
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
      NEW.investment_plan := OLD.investment_plan;
      NEW.status := OLD.status;
      NEW.email := OLD.email;
      NEW.user_id := OLD.user_id;
      NEW.last_compound_at := OLD.last_compound_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
