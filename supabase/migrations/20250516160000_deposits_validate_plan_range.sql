-- Enforce deposit amount vs investor investment_plan (canonical Starter/Growth/Pro/Elite).

CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_plan text;
  mn numeric;
  mx numeric;
  has_max boolean := true;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'deposit requires user_id';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount::numeric <= 0 THEN
    RAISE EXCEPTION 'deposit amount must be positive';
  END IF;

  SELECT lower(trim(coalesce(i.investment_plan, '')))
  INTO inv_plan
  FROM public.investors AS i
  WHERE i.user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'investor profile not found for deposit';
  END IF;

  IF inv_plan IS NULL OR trim(inv_plan) = '' THEN
    inv_plan := 'starter';
  END IF;

  IF inv_plan = 'elite' THEN
    mn := 5000;
    mx := NULL;
    has_max := false;
  ELSIF inv_plan = 'pro' THEN
    mn := 1500;
    mx := 5000;
  ELSIF inv_plan = 'growth' THEN
    mn := 500;
    mx := 1500;
  ELSIF inv_plan = 'starter' THEN
    mn := 200;
    mx := 500;
  ELSE
    mn := 200;
    mx := 500;
  END IF;

  IF NEW.amount::numeric < mn THEN
    RAISE EXCEPTION
      'deposit % is below minimum % for plan %',
      NEW.amount,
      mn,
      inv_plan
      USING ERRCODE = '23514';
  END IF;

  IF has_max AND NEW.amount::numeric > mx THEN
    RAISE EXCEPTION
      'deposit % exceeds maximum % for plan %',
      NEW.amount,
      mx,
      inv_plan
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.deposits_before_insert_validate_plan_range() FROM PUBLIC;

DROP TRIGGER IF EXISTS deposits_validate_plan_amount ON public.deposits;
CREATE TRIGGER deposits_validate_plan_amount
BEFORE INSERT ON public.deposits
FOR EACH ROW
EXECUTE PROCEDURE public.deposits_before_insert_validate_plan_range();
