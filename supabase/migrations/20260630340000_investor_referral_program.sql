-- Investor referral program:
-- - every investor gets a unique referral code/link
-- - signup metadata or deposit referral_code can attribute a referred investor
-- - approved deposits pay 5% to the referrer as 30-day locked principal

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE OR REPLACE FUNCTION public._normalize_referral_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(upper(trim(coalesce(p_code, ''))), '[^A-Z0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.generate_investor_referral_code(
  p_email text,
  p_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  base text;
  candidate text;
  attempt integer := 0;
BEGIN
  base := regexp_replace(upper(split_part(coalesce(p_email, ''), '@', 1)), '[^A-Z0-9]', '', 'g');
  base := left(coalesce(nullif(base, ''), 'ZUNO'), 6);

  LOOP
    attempt := attempt + 1;
    candidate := public._normalize_referral_code(
      base || left(replace(gen_random_uuid()::text, '-', ''), 6)
    );

    IF NOT EXISTS (
      SELECT 1
      FROM public.investors AS i
      WHERE public._normalize_referral_code(i.referral_code) = candidate
        AND (p_user_id IS NULL OR i.user_id IS DISTINCT FROM p_user_id)
    ) THEN
      RETURN candidate;
    END IF;

    IF attempt >= 20 THEN
      RETURN public._normalize_referral_code('ZUNO' || left(replace(gen_random_uuid()::text, '-', ''), 10));
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._referral_referrer_for_code(
  p_code text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT i.user_id
  FROM public.investors AS i
  WHERE public._normalize_referral_code(i.referral_code) = public._normalize_referral_code(p_code)
    AND public._normalize_referral_code(p_code) <> ''
    AND (p_exclude_user_id IS NULL OR i.user_id IS DISTINCT FROM p_exclude_user_id)
  ORDER BY i.created_at ASC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.investors_set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  NEW.referral_code := public._normalize_referral_code(NEW.referral_code);
  IF coalesce(NEW.referral_code, '') = '' THEN
    NEW.referral_code := public.generate_investor_referral_code(NEW.email, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.investors AS i
SET referral_code = public.generate_investor_referral_code(i.email, i.user_id)
WHERE coalesce(public._normalize_referral_code(i.referral_code), '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS investors_referral_code_unique_idx
  ON public.investors (public._normalize_referral_code(referral_code));

ALTER TABLE public.investors
  ALTER COLUMN referral_code SET NOT NULL;

DROP TRIGGER IF EXISTS investors_set_referral_code_trg ON public.investors;
CREATE TRIGGER investors_set_referral_code_trg
BEFORE INSERT OR UPDATE OF referral_code
ON public.investors
FOR EACH ROW
EXECUTE FUNCTION public.investors_set_referral_code();

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.deposits (id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referral_code text,
  deposit_amount numeric NOT NULL CHECK (deposit_amount >= 0),
  bonus_amount numeric NOT NULL CHECK (bonus_amount >= 0),
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deposit_id)
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx
  ON public.referral_rewards (referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_rewards_referred_idx
  ON public.referral_rewards (referred_user_id, created_at DESC);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_rewards_select_own_or_admin ON public.referral_rewards;
CREATE POLICY referral_rewards_select_own_or_admin
ON public.referral_rewards
FOR SELECT
TO authenticated
USING (
  referrer_user_id = auth.uid()
  OR referred_user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

ALTER TABLE public.principal_locks
  ALTER COLUMN deposit_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS lock_source text NOT NULL DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS referral_reward_id uuid REFERENCES public.referral_rewards (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS principal_locks_referral_reward_unique_idx
  ON public.principal_locks (referral_reward_id)
  WHERE referral_reward_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_investor_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  fn text := NULLIF(trim(meta->>'first_name'), '');
  mn text := NULLIF(trim(meta->>'middle_name'), '');
  sn text := NULLIF(trim(meta->>'surname'), '');
  full_nm text := NULLIF(trim(meta->>'full_name'), '');
  ref_code text := public._normalize_referral_code(meta->>'referral_code');
  referrer_uid uuid;
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.investors WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF full_nm IS NULL AND (fn IS NOT NULL OR sn IS NOT NULL) THEN
    full_nm := trim(concat_ws(' ', fn, mn, sn));
  END IF;

  IF ref_code <> '' THEN
    referrer_uid := public._referral_referrer_for_code(ref_code, NEW.id);
  END IF;

  INSERT INTO public.investors (
    user_id,
    email,
    full_name,
    first_name,
    middle_name,
    surname,
    dob,
    phone,
    balance,
    total_profit,
    investment_plan,
    status,
    referred_by_user_id,
    referred_at
  )
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE(full_nm, ''),
    fn,
    mn,
    sn,
    CASE
      WHEN meta ? 'dob' AND length(trim(meta->>'dob')) > 0 THEN (trim(meta->>'dob'))::date
      ELSE NULL
    END,
    NULLIF(trim(meta->>'phone'), ''),
    0,
    0,
    COALESCE(NULLIF(trim(meta->>'investment_plan'), ''), 'Starter'),
    'active',
    referrer_uid,
    CASE WHEN referrer_uid IS NULL THEN NULL ELSE now() END
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'sync_investor_profile_from_auth_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral_bonus_for_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  referred_inv public.investors%ROWTYPE;
  referrer_uid uuid;
  referrer_email text := '';
  referrer_code text := '';
  bonus numeric;
  until_ts timestamptz;
  reward_id uuid;
BEGIN
  SELECT *
  INTO d
  FROM public.deposits AS dep
  WHERE dep.id = p_deposit_id;

  IF NOT FOUND OR d.status IS DISTINCT FROM 'approved' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referral_rewards AS rr WHERE rr.deposit_id = p_deposit_id
  ) THEN
    RETURN;
  END IF;

  SELECT *
  INTO referred_inv
  FROM public.investors AS inv
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email))
  LIMIT 1;

  IF NOT FOUND OR referred_inv.user_id IS NULL THEN
    RETURN;
  END IF;

  referrer_uid := referred_inv.referred_by_user_id;

  IF referrer_uid IS NULL AND coalesce(public._normalize_referral_code(d.referral_code), '') <> '' THEN
    referrer_uid := public._referral_referrer_for_code(d.referral_code, referred_inv.user_id);

    IF referrer_uid IS NOT NULL THEN
      UPDATE public.investors AS inv
      SET
        referred_by_user_id = referrer_uid,
        referred_at = coalesce(inv.referred_at, now())
      WHERE inv.user_id = referred_inv.user_id
        AND inv.referred_by_user_id IS NULL;
    END IF;
  END IF;

  IF referrer_uid IS NULL OR referrer_uid IS NOT DISTINCT FROM referred_inv.user_id THEN
    RETURN;
  END IF;

  bonus := round(coalesce(d.amount, 0)::numeric * 0.05, 8);
  IF bonus <= 0 THEN
    RETURN;
  END IF;

  SELECT lower(trim(coalesce(inv.email, ''))), inv.referral_code
  INTO referrer_email, referrer_code
  FROM public.investors AS inv
  WHERE inv.user_id = referrer_uid
  LIMIT 1;

  IF coalesce(referrer_email, '') = '' THEN
    RETURN;
  END IF;

  until_ts := now() + interval '30 days';

  INSERT INTO public.referral_rewards (
    deposit_id,
    referrer_user_id,
    referred_user_id,
    referral_code,
    deposit_amount,
    bonus_amount,
    locked_until
  )
  VALUES (
    p_deposit_id,
    referrer_uid,
    referred_inv.user_id,
    referrer_code,
    coalesce(d.amount, 0)::numeric,
    bonus,
    until_ts
  )
  RETURNING id INTO reward_id;

  UPDATE public.investors AS inv
  SET
    balance = coalesce(inv.balance, 0)::numeric + bonus,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bonus
  WHERE inv.user_id = referrer_uid;

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until,
    lock_source,
    referral_reward_id
  )
  VALUES (
    NULL,
    referrer_uid,
    referrer_email,
    bonus,
    until_ts,
    'referral_bonus',
    reward_id
  );

  PERFORM public.sync_investment_plan_from_principal(referrer_uid);

  PERFORM public.tp_emit_investor_notification(
    referrer_uid,
    referrer_email,
    'Referral bonus credited',
    format(
      'You earned a $%s referral bonus. It has been added to your locked principal and unlocks after 30 days.',
      public._format_money_display(bonus)
    ),
    'referral_bonus'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric := 0;
  until_ts timestamptz;
  sync_uid uuid;
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
  SET
    balance = coalesce(inv.balance, 0)::numeric + bump,
    locked_principal_balance = coalesce(inv.locked_principal_balance, 0)::numeric + bump
  WHERE inv.user_id = d.user_id
     OR lower(trim(inv.email)) = lower(trim(d.investor_email));

  until_ts := now() + interval '30 days';

  INSERT INTO public.principal_locks (
    deposit_id,
    user_id,
    investor_email,
    principal_amount,
    locked_until,
    lock_source
  )
  VALUES (
    p_deposit_id,
    d.user_id,
    coalesce(trim(d.investor_email), ''),
    bump,
    until_ts,
    'deposit'
  );

  sync_uid := d.user_id;
  IF sync_uid IS NULL THEN
    SELECT inv.user_id
    INTO sync_uid
    FROM public.investors AS inv
    WHERE lower(trim(inv.email)) = lower(trim(d.investor_email))
    LIMIT 1;
  END IF;

  IF sync_uid IS NOT NULL THEN
    PERFORM public.sync_investment_plan_from_principal(sync_uid);
  END IF;

  PERFORM public.apply_referral_bonus_for_deposit(p_deposit_id);
END;
$$;

REVOKE ALL ON FUNCTION public._normalize_referral_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_investor_referral_code(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._referral_referrer_for_code(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.investors_set_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_referral_bonus_for_deposit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_investor_profile_from_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
