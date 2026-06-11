-- Banned investors: report full balance as withdrawable on account status reads.

CREATE OR REPLACE FUNCTION public.investor_get_account_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.investors%ROWTYPE;
  st text;
  bal numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO inv
  FROM public.investors AS i
  WHERE i.user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  st := lower(trim(coalesce(inv.account_status, inv.status, 'active')));
  bal := coalesce(inv.balance, 0);

  RETURN jsonb_build_object(
    'account_status', st,
    'status_reason', inv.status_reason,
    'status_updated_at', inv.status_updated_at,
    'balance', bal,
    'withdrawable_balance', CASE WHEN st = 'banned' THEN bal ELSE coalesce(inv.withdrawable_balance, 0) END,
    'withdrawal_eligible_at', inv.withdrawal_eligible_at,
    'full_name', coalesce(inv.full_name, ''),
    'email', coalesce(inv.email, '')
  );
END;
$$;
