-- Harden approve_deposit: only admins, idempotent-ish when not pending.

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit not found';
  END IF;

  IF d.status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  bump := coalesce(d.amount::numeric, 0);

  UPDATE public.deposits AS dep
  SET status = 'approved'
  WHERE dep.id = p_deposit_id;

  UPDATE public.investors AS inv
  SET balance = coalesce(inv.balance, 0) + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
