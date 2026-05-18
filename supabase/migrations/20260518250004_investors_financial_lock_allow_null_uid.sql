-- Allow server-side / service-role updates (auth.uid() IS NULL). Previously NOT is_admin(NULL)
-- evaluated true and reverted every balance change from RPCs, triggers, and SQL editor.

CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
      NEW.balance := OLD.balance;
      NEW.total_profit := OLD.total_profit;
      NEW.locked_principal_balance := OLD.locked_principal_balance;
      NEW.withdrawable_balance := OLD.withdrawable_balance;
      NEW.withdrawable_profit := OLD.withdrawable_profit;
      NEW.withdrawable_principal := OLD.withdrawable_principal;
      NEW.investment_plan := OLD.investment_plan;
      NEW.tier_manual_override := OLD.tier_manual_override;
      NEW.profit_auto_accrue := OLD.profit_auto_accrue;
      NEW.status := OLD.status;
      NEW.email := OLD.email;
      NEW.user_id := OLD.user_id;
      NEW.last_compound_at := OLD.last_compound_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
