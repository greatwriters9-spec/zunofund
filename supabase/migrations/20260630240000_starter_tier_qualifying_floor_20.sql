-- Starter qualifying-principal bracket marketing floor is $20 (Growth still from $500+).
-- Drops redundant WHEN branch; tiers below Growth remain Starter (unchanged behavior).

CREATE OR REPLACE FUNCTION public.investment_plan_slug_for_principal(p_usd numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_usd, 0) >= 5000 THEN 'Elite'
    WHEN COALESCE(p_usd, 0) >= 1500 THEN 'Pro'
    WHEN COALESCE(p_usd, 0) >= 500 THEN 'Growth'
    ELSE 'Starter'
  END;
$$;

REVOKE ALL ON FUNCTION public.investment_plan_slug_for_principal(numeric) FROM PUBLIC;

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
