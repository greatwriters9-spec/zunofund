-- Rewards & Loyalty Program: ledger, holding streak, milestones, tier upgrades, dashboard RPC.

-- ---------------------------------------------------------------------------
-- Settings (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_program_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  program_enabled boolean NOT NULL DEFAULT true,
  holding_bonus_enabled boolean NOT NULL DEFAULT true,
  holding_bonus_amount numeric NOT NULL DEFAULT 100,
  holding_days_required integer NOT NULL DEFAULT 30,
  tier_growth_pro_amount numeric NOT NULL DEFAULT 100,
  tier_pro_elite_amount numeric NOT NULL DEFAULT 250,
  portfolio_10k_amount numeric NOT NULL DEFAULT 250,
  portfolio_25k_amount numeric NOT NULL DEFAULT 500,
  referral_10_amount numeric NOT NULL DEFAULT 50,
  referral_25_amount numeric NOT NULL DEFAULT 150,
  reinvestment_bonus_percent numeric NOT NULL DEFAULT 2,
  reinvestment_bonus_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.reward_program_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Investor loyalty columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS holding_days_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holding_streak_last_date date,
  ADD COLUMN IF NOT EXISTS loyalty_tier text NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS merchant_eligible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.investors.holding_days_streak IS 'Consecutive UTC days with active investment balance > 0.';
COMMENT ON COLUMN public.investors.merchant_eligible IS 'Elite-tier investors eligible for merchant application (admin approves).';

-- ---------------------------------------------------------------------------
-- Rewards ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investor_rewards_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investor_email text,
  reward_key text NOT NULL,
  reward_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  badge_key text,
  status text NOT NULL DEFAULT 'completed',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  granted_by uuid,
  CONSTRAINT investor_rewards_ledger_user_key UNIQUE (user_id, reward_key)
);

CREATE INDEX IF NOT EXISTS investor_rewards_ledger_user_granted_idx
  ON public.investor_rewards_ledger (user_id, granted_at DESC);

ALTER TABLE public.investor_rewards_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_rewards_ledger_select_own ON public.investor_rewards_ledger;
CREATE POLICY investor_rewards_ledger_select_own
ON public.investor_rewards_ledger
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

DROP POLICY IF EXISTS investor_rewards_ledger_admin_write ON public.investor_rewards_ledger;
CREATE POLICY investor_rewards_ledger_admin_write
ON public.investor_rewards_ledger
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.reward_program_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_program_settings_select_authenticated ON public.reward_program_settings;
CREATE POLICY reward_program_settings_select_authenticated
ON public.reward_program_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS reward_program_settings_admin_update ON public.reward_program_settings;
CREATE POLICY reward_program_settings_admin_update
ON public.reward_program_settings
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reward_settings_row()
RETURNS public.reward_program_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.reward_program_settings WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public._reward_settings_row() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._investment_plan_rank(p_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(lower(trim(p_plan)), '') LIKE '%elite%' THEN 3
    WHEN coalesce(lower(trim(p_plan)), '') LIKE '%pro%' THEN 2
    WHEN coalesce(lower(trim(p_plan)), '') LIKE '%growth%' THEN 1
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public._investment_plan_rank(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._investor_balance_for_rewards(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(inv.balance, 0)::numeric
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._investor_balance_for_rewards(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._count_active_referrals(p_referrer_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.investors AS ref
  WHERE ref.referred_by_user_id = p_referrer_user_id
    AND coalesce(ref.balance, 0) > 0
    AND EXISTS (
      SELECT 1
      FROM public.deposits AS d
      WHERE d.user_id = ref.user_id
        AND lower(trim(coalesce(d.status, ''))) = 'approved'
    );
$$;

REVOKE ALL ON FUNCTION public._count_active_referrals(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._total_approved_deposits_usd(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(d.amount::numeric), 0)
  FROM public.deposits AS d
  WHERE d.user_id = p_user_id
    AND lower(trim(coalesce(d.status, ''))) = 'approved';
$$;

REVOKE ALL ON FUNCTION public._total_approved_deposits_usd(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Grant reward (idempotent per reward_key)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_investor_reward(
  p_user_id uuid,
  p_reward_key text,
  p_reward_type text,
  p_amount numeric DEFAULT 0,
  p_badge_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_granted_by uuid DEFAULT NULL,
  p_notification_type text DEFAULT 'reward_unlocked',
  p_notification_title text DEFAULT NULL,
  p_notification_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.reward_program_settings;
  inv_email text;
  amt numeric;
  rows_inserted integer := 0;
BEGIN
  IF p_user_id IS NULL OR coalesce(trim(p_reward_key), '') = '' THEN
    RETURN false;
  END IF;

  cfg := public._reward_settings_row();
  IF NOT coalesce(cfg.program_enabled, true) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.investor_rewards_ledger AS l
    WHERE l.user_id = p_user_id
      AND l.reward_key = p_reward_key
      AND l.revoked_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  SELECT lower(trim(coalesce(inv.email, '')))
  INTO inv_email
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id
  LIMIT 1;

  amt := round(greatest(coalesce(p_amount, 0), 0)::numeric, 8);

  INSERT INTO public.investor_rewards_ledger (
    user_id,
    investor_email,
    reward_key,
    reward_type,
    amount,
    badge_key,
    status,
    description,
    metadata,
    granted_by
  )
  VALUES (
    p_user_id,
    nullif(inv_email, ''),
    p_reward_key,
    p_reward_type,
    amt,
    nullif(trim(p_badge_key), ''),
    'completed',
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    p_granted_by
  )
  ON CONFLICT (user_id, reward_key) DO NOTHING;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  IF rows_inserted = 0 THEN
    RETURN false;
  END IF;

  IF amt > 0 THEN
    UPDATE public.investors AS inv
    SET
      balance = coalesce(inv.balance, 0)::numeric + amt,
      withdrawable_profit = coalesce(inv.withdrawable_profit, 0)::numeric + amt
    WHERE inv.user_id = p_user_id;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    p_user_id,
    inv_email,
    coalesce(p_notification_title, 'Reward unlocked'),
    coalesce(
      p_notification_message,
      coalesce(p_description, format('You unlocked a reward: %s.', p_reward_type))
    ),
    coalesce(nullif(trim(p_notification_type), ''), 'reward_unlocked')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_investor_reward(uuid, text, text, numeric, text, text, jsonb, uuid, text, text, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Loyalty tier sync
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_investor_loyalty_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal numeric;
  deps numeric;
  refs integer;
  hold_days integer;
  inv_plan text;
  new_tier text := 'bronze';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'bronze';
  END IF;

  bal := public._investor_balance_for_rewards(p_user_id);
  deps := public._total_approved_deposits_usd(p_user_id);
  refs := public._count_active_referrals(p_user_id);

  SELECT coalesce(inv.holding_days_streak, 0), coalesce(inv.investment_plan, '')
  INTO hold_days, inv_plan
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id;

  IF bal >= 25000 OR refs >= 50 OR lower(trim(inv_plan)) LIKE '%elite%' THEN
    new_tier := 'elite';
  ELSIF bal >= 10000 OR refs >= 25 OR hold_days >= 30 THEN
    new_tier := 'platinum';
  ELSIF bal >= 2500 OR deps >= 5000 OR refs >= 10 THEN
    new_tier := 'gold';
  ELSIF bal >= 500 OR deps >= 1000 OR refs >= 3 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;

  UPDATE public.investors AS inv
  SET loyalty_tier = new_tier
  WHERE inv.user_id = p_user_id
    AND inv.loyalty_tier IS DISTINCT FROM new_tier;

  RETURN new_tier;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_investor_loyalty_tier(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Milestone evaluators
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_portfolio_milestone_rewards(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  bal := public._investor_balance_for_rewards(p_user_id);

  IF bal >= 5000 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'portfolio_5000', 'portfolio_milestone', 0, 'vip_investor',
      'VIP Investor Badge — $5,000 portfolio milestone',
      jsonb_build_object('portfolio_usd', bal),
      NULL, 'reward_unlocked', 'Portfolio milestone',
      'You earned the VIP Investor badge for reaching $5,000 portfolio value.'
    );
  END IF;

  IF bal >= 10000 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'portfolio_10000', 'portfolio_milestone',
      (SELECT portfolio_10k_amount FROM public.reward_program_settings WHERE id = 1),
      NULL, 'Portfolio milestone — $10,000 balance bonus',
      jsonb_build_object('portfolio_usd', bal),
      NULL, 'reward_unlocked', 'Portfolio bonus',
      'A $250 bonus was credited for reaching $10,000 portfolio value.'
    );
  END IF;

  IF bal >= 25000 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'portfolio_25000', 'portfolio_milestone',
      (SELECT portfolio_25k_amount FROM public.reward_program_settings WHERE id = 1),
      NULL, 'Portfolio milestone — $25,000 balance bonus',
      jsonb_build_object('portfolio_usd', bal)
    );
  END IF;

  IF bal >= 50000 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'portfolio_50000', 'portfolio_milestone', 0, 'account_manager',
      'Dedicated Account Manager badge — $50,000 portfolio milestone',
      jsonb_build_object('portfolio_usd', bal),
      NULL, 'reward_unlocked', 'Portfolio milestone',
      'You unlocked the Dedicated Account Manager badge.'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_portfolio_milestone_rewards(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_referral_milestone_rewards(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.reward_program_settings;
  refs integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  cfg := public._reward_settings_row();
  refs := public._count_active_referrals(p_user_id);

  IF refs >= 10 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'referral_10', 'referral_milestone', cfg.referral_10_amount, NULL,
      'Referral milestone — 10 active referrals',
      jsonb_build_object('active_referrals', refs),
      NULL, 'referral_milestone', 'Referral milestone reached',
      format('You earned a $%s bonus for 10 active referrals.', cfg.referral_10_amount::text)
    );
  END IF;

  IF refs >= 25 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'referral_25', 'referral_milestone', cfg.referral_25_amount, NULL,
      'Referral milestone — 25 active referrals',
      jsonb_build_object('active_referrals', refs),
      NULL, 'referral_milestone', 'Referral milestone reached',
      format('You earned a $%s bonus for 25 active referrals.', cfg.referral_25_amount::text)
    );
  END IF;

  IF refs >= 50 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'referral_50', 'referral_milestone', 0, 'vip_referral',
      'VIP Referral badge — 50 active referrals',
      jsonb_build_object('active_referrals', refs)
    );
  END IF;

  IF refs >= 100 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'referral_100', 'referral_milestone', 0, 'partner_status',
      'Partner Status badge — 100 active referrals',
      jsonb_build_object('active_referrals', refs)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_referral_milestone_rewards(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_tier_upgrade_rewards(
  p_user_id uuid,
  p_old_plan text,
  p_new_plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.reward_program_settings;
  old_r integer;
  new_r integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  cfg := public._reward_settings_row();
  old_r := public._investment_plan_rank(p_old_plan);
  new_r := public._investment_plan_rank(p_new_plan);

  IF old_r = 1 AND new_r = 2 THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'tier_growth_pro', 'tier_upgrade', cfg.tier_growth_pro_amount, NULL,
      'Tier upgrade reward — Growth to Pro',
      jsonb_build_object('from', p_old_plan, 'to', p_new_plan),
      NULL, 'tier_upgraded', 'Investment tier upgraded',
      format('You received a $%s reward for reaching Pro tier.', cfg.tier_growth_pro_amount::text)
    );
  END IF;

  IF old_r = 2 AND new_r = 3 AND lower(trim(p_new_plan)) LIKE '%elite%' THEN
    PERFORM public.grant_investor_reward(
      p_user_id, 'tier_pro_elite', 'tier_upgrade', cfg.tier_pro_elite_amount, NULL,
      'Tier upgrade reward — Pro to Elite',
      jsonb_build_object('from', p_old_plan, 'to', p_new_plan),
      NULL, 'tier_upgraded', 'Elite tier unlocked',
      format('You received a $%s reward for reaching Elite tier.', cfg.tier_pro_elite_amount::text)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_tier_upgrade_rewards(uuid, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_elite_investor_benefits(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_email text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.investors AS inv
  SET merchant_eligible = true
  WHERE inv.user_id = p_user_id
    AND coalesce(inv.merchant_eligible, false) = false;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT lower(trim(coalesce(inv.email, '')))
  INTO inv_email
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id;

  PERFORM public.tp_emit_investor_notification(
    p_user_id,
    inv_email,
    'Elite status achieved',
    'You unlocked Elite investor benefits and merchant program eligibility. Contact support or admin to apply as a verified merchant.',
    'elite_status'
  );

  PERFORM public.tp_emit_investor_notification(
    p_user_id,
    inv_email,
    'Merchant access available',
    'Your account is eligible to apply for verified merchant status (P2P offers, analytics, and fee earnings).',
    'merchant_access_granted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_elite_investor_benefits(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_reinvestment_bonus(
  p_user_id uuid,
  p_deposit_id uuid,
  p_deposit_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.reward_program_settings;
  wp numeric;
  bonus numeric;
  key text;
BEGIN
  IF p_user_id IS NULL OR p_deposit_id IS NULL THEN
    RETURN;
  END IF;

  cfg := public._reward_settings_row();
  IF NOT coalesce(cfg.program_enabled, true)
     OR NOT coalesce(cfg.reinvestment_bonus_enabled, true) THEN
    RETURN;
  END IF;

  SELECT coalesce(inv.withdrawable_profit, 0)::numeric
  INTO wp
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id;

  IF wp <= 0 OR coalesce(p_deposit_amount, 0) <= 0 THEN
    RETURN;
  END IF;

  bonus := round(p_deposit_amount * (coalesce(cfg.reinvestment_bonus_percent, 2) / 100.0), 8);
  IF bonus <= 0 THEN
    RETURN;
  END IF;

  key := 'reinvestment_' || p_deposit_id::text;

  PERFORM public.grant_investor_reward(
    p_user_id,
    key,
    'reinvestment_bonus',
    bonus,
    NULL,
    format('Reinvestment bonus (%s%% of deposit)', cfg.reinvestment_bonus_percent::text),
    jsonb_build_object('deposit_id', p_deposit_id, 'deposit_amount', p_deposit_amount),
    NULL,
    'reward_unlocked',
    'Reinvestment bonus',
    format('A %s%% reinvestment bonus ($%s) was added to your balance.', cfg.reinvestment_bonus_percent::text, bonus::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_reinvestment_bonus(uuid, uuid, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_investor_rewards_bundle(p_user_id uuid, p_deposit_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep_amt numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.sync_investor_loyalty_tier(p_user_id);
  PERFORM public.evaluate_portfolio_milestone_rewards(p_user_id);
  PERFORM public.evaluate_referral_milestone_rewards(p_user_id);

  IF p_deposit_id IS NOT NULL THEN
    SELECT coalesce(d.amount::numeric, 0)
    INTO dep_amt
    FROM public.deposits AS d
    WHERE d.id = p_deposit_id;

    PERFORM public.evaluate_reinvestment_bonus(p_user_id, p_deposit_id, dep_amt);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_investor_rewards_bundle(uuid, uuid) FROM PUBLIC;

-- Holding streak (UTC calendar days)
CREATE OR REPLACE FUNCTION public.advance_investor_holding_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.reward_program_settings;
  bal numeric;
  today_utc date := (NOW() AT TIME ZONE 'UTC')::date;
  last_date date;
  streak integer;
  req_days integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  cfg := public._reward_settings_row();
  IF NOT coalesce(cfg.program_enabled, true)
     OR NOT coalesce(cfg.holding_bonus_enabled, true) THEN
    RETURN;
  END IF;

  SELECT coalesce(inv.balance, 0)::numeric, inv.holding_streak_last_date, coalesce(inv.holding_days_streak, 0)
  INTO bal, last_date, streak
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  req_days := greatest(coalesce(cfg.holding_days_required, 30), 1);

  IF bal <= 0 THEN
    UPDATE public.investors AS inv
    SET holding_days_streak = 0, holding_streak_last_date = NULL
    WHERE inv.user_id = p_user_id;
    RETURN;
  END IF;

  IF last_date IS NULL THEN
    streak := 1;
  ELSIF last_date = today_utc THEN
    RETURN;
  ELSIF last_date = today_utc - 1 THEN
    streak := streak + 1;
  ELSE
    streak := 1;
  END IF;

  UPDATE public.investors AS inv
  SET
    holding_days_streak = streak,
    holding_streak_last_date = today_utc
  WHERE inv.user_id = p_user_id;

  IF streak >= req_days THEN
    PERFORM public.grant_investor_reward(
      p_user_id,
      'holding_30_days',
      'holding_bonus',
      cfg.holding_bonus_amount,
      NULL,
      format('Holding bonus — %s consecutive days with active balance', req_days::text),
      jsonb_build_object('days_held', streak),
      NULL,
      'reward_unlocked',
      'Holding bonus unlocked',
      format('You received a $%s holding bonus for maintaining your investment for %s days.', cfg.holding_bonus_amount::text, req_days::text)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_investor_holding_streak(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.advance_all_holding_streaks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  n integer := 0;
BEGIN
  FOR uid IN
    SELECT inv.user_id
    FROM public.investors AS inv
    WHERE inv.user_id IS NOT NULL
      AND lower(trim(coalesce(inv.status, ''))) = 'active'
  LOOP
    PERFORM public.advance_investor_holding_streak(uid);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_all_holding_streaks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_all_holding_streaks() TO service_role;

-- ---------------------------------------------------------------------------
-- Patch tier sync + deposit approval + daily jobs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_investment_plan_from_principal(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_ov boolean;
  tqp numeric;
  old_slug text;
  new_slug text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    coalesce(inv.tier_manual_override, false),
    inv.tier_qualifying_principal,
    inv.investment_plan
  INTO is_ov, tqp, old_slug
  FROM public.investors AS inv
  WHERE inv.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF is_ov THEN
    RETURN;
  END IF;

  new_slug := public.investment_plan_slug_for_principal(tqp);

  UPDATE public.investors AS inv
  SET investment_plan = new_slug
  WHERE inv.user_id = p_user_id
    AND inv.investment_plan IS DISTINCT FROM new_slug;

  IF FOUND AND old_slug IS DISTINCT FROM new_slug THEN
    PERFORM public.evaluate_tier_upgrade_rewards(p_user_id, old_slug, new_slug);
    IF lower(trim(new_slug)) LIKE '%elite%'
       AND NOT (coalesce(lower(trim(old_slug)), '') LIKE '%elite%') THEN
      PERFORM public.evaluate_elite_investor_benefits(p_user_id);
    END IF;
  END IF;

  PERFORM public.evaluate_investor_rewards_bundle(p_user_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_investment_plan_from_principal(uuid) FROM PUBLIC;

-- approve_deposit: evaluate rewards after referral
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  bump numeric;
  until_ts timestamptz;
  investor_uid uuid;
  referrer_uid uuid;
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

  investor_uid := d.user_id;
  IF investor_uid IS NULL THEN
    SELECT inv.user_id
    INTO investor_uid
    FROM public.investors AS inv
    WHERE lower(trim(inv.email)) = lower(trim(d.investor_email))
    LIMIT 1;
  END IF;

  IF investor_uid IS NOT NULL THEN
    PERFORM public.sync_investment_plan_from_principal(investor_uid);
    PERFORM public.evaluate_investor_rewards_bundle(investor_uid, p_deposit_id);
    PERFORM public.advance_investor_holding_streak(investor_uid);
  END IF;

  PERFORM public.apply_referral_bonus_for_deposit(p_deposit_id);

  IF investor_uid IS NOT NULL THEN
    PERFORM public.evaluate_referral_milestone_rewards(investor_uid);

    SELECT inv.referred_by_user_id
    INTO referrer_uid
    FROM public.investors AS inv
    WHERE inv.user_id = investor_uid;

    IF referrer_uid IS NOT NULL THEN
      PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Investor dashboard RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_rewards_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.investors%ROWTYPE;
  cfg public.reward_program_settings;
  bal numeric;
  refs integer;
  deps numeric;
  req_days integer;
  claimed_keys text[];
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO inv FROM public.investors AS i WHERE i.user_id = uid LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'investor_not_found');
  END IF;

  cfg := public._reward_settings_row();
  bal := coalesce(inv.balance, 0)::numeric;
  refs := public._count_active_referrals(uid);
  deps := public._total_approved_deposits_usd(uid);
  req_days := greatest(coalesce(cfg.holding_days_required, 30), 1);

  SELECT coalesce(array_agg(l.reward_key), ARRAY[]::text[])
  INTO claimed_keys
  FROM public.investor_rewards_ledger AS l
  WHERE l.user_id = uid
    AND l.revoked_at IS NULL;

  result := jsonb_build_object(
    'program_enabled', coalesce(cfg.program_enabled, true),
    'loyalty_tier', coalesce(inv.loyalty_tier, 'bronze'),
    'investment_plan', coalesce(inv.investment_plan, 'Starter'),
    'portfolio_usd', bal,
    'total_deposits_usd', deps,
    'active_referrals', refs,
    'holding_days', coalesce(inv.holding_days_streak, 0),
    'holding_days_required', req_days,
    'merchant_eligible', coalesce(inv.merchant_eligible, false),
    'merchant_status', (
      SELECT mp.status
      FROM public.merchant_profiles AS mp
      WHERE mp.user_id = uid
      LIMIT 1
    ),
    'claimed_reward_keys', to_jsonb(claimed_keys),
    'history', (
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.granted_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          l.id,
          l.reward_key,
          l.reward_type,
          l.amount,
          l.badge_key,
          l.status,
          l.description,
          l.granted_at
        FROM public.investor_rewards_ledger AS l
        WHERE l.user_id = uid
          AND l.revoked_at IS NULL
        ORDER BY l.granted_at DESC
        LIMIT 50
      ) AS t
    )
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_rewards_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_rewards_dashboard() TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin reward ops
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_investor_reward(
  p_investor_user_id uuid,
  p_reward_key text,
  p_reward_type text,
  p_amount numeric DEFAULT 0,
  p_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN public.grant_investor_reward(
    p_investor_user_id,
    p_reward_key,
    coalesce(nullif(trim(p_reward_type), ''), 'manual_grant'),
    coalesce(p_amount, 0),
    NULL,
    coalesce(p_description, 'Manual reward grant by admin'),
    jsonb_build_object('admin_id', auth.uid()),
    auth.uid(),
    'reward_unlocked',
    'Reward granted',
    coalesce(p_description, 'An admin credited a reward to your account.')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_investor_reward(uuid, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_investor_reward(uuid, text, text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_investor_reward(
  p_ledger_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.investor_rewards_ledger%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO row FROM public.investor_rewards_ledger WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND OR row.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.investor_rewards_ledger
  SET
    revoked_at = now(),
    status = 'revoked',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', coalesce(p_reason, ''))
  WHERE id = p_ledger_id;

  IF coalesce(row.amount, 0) > 0 THEN
    UPDATE public.investors AS inv
    SET
      balance = greatest(0, coalesce(inv.balance, 0)::numeric - row.amount),
      withdrawable_profit = greatest(0, coalesce(inv.withdrawable_profit, 0)::numeric - row.amount)
    WHERE inv.user_id = row.user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_investor_reward(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_investor_reward(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reward_program_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_grants', (SELECT count(*)::integer FROM public.investor_rewards_ledger WHERE revoked_at IS NULL),
    'total_amount_usd', (SELECT coalesce(sum(amount), 0) FROM public.investor_rewards_ledger WHERE revoked_at IS NULL),
    'grants_last_7d', (
      SELECT count(*)::integer
      FROM public.investor_rewards_ledger
      WHERE revoked_at IS NULL AND granted_at >= now() - interval '7 days'
    ),
    'by_type', (
      SELECT coalesce(jsonb_object_agg(reward_type, cnt), '{}'::jsonb)
      FROM (
        SELECT reward_type, count(*)::integer AS cnt
        FROM public.investor_rewards_ledger
        WHERE revoked_at IS NULL
        GROUP BY reward_type
      ) AS t
    )
  )
  WHERE public.is_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.admin_reward_program_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reward_program_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- Transaction history includes rewards ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_recent_transactions(p_limit integer DEFAULT 150)
RETURNS TABLE (
  id uuid,
  txn_type text,
  amount numeric,
  status text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      d.id,
      'deposit'::text AS txn_type,
      d.amount::numeric AS amt,
      coalesce(d.status, 'completed') AS st,
      'Deposit'::text AS descr,
      d.created_at AS ts
    FROM public.deposits AS d
    WHERE d.user_id = auth.uid()

    UNION ALL

    SELECT
      w.id,
      'withdrawal'::text,
      w.amount::numeric,
      coalesce(w.status, 'completed'),
      CASE
        WHEN w.merchant_order_id IS NOT NULL THEN 'P2P withdrawal'::text
        ELSE 'Withdrawal'::text
      END,
      w.created_at
    FROM public.withdrawals AS w
    WHERE w.user_id = auth.uid()
       OR lower(trim(w.investor_email))
          IS NOT DISTINCT FROM public.request_email()

    UNION ALL

    SELECT
      p.id,
      'profit'::text,
      p.amount::numeric,
      coalesce(p.status, 'completed'),
      coalesce(p.description, 'Profit Added'),
      p.created_at
    FROM public.profits AS p
    WHERE p.user_id = auth.uid()
       OR lower(trim(p.investor_email))
          IS NOT DISTINCT FROM public.request_email()

    UNION ALL

    SELECT
      rr.id,
      'referral_bonus'::text,
      rr.bonus_amount::numeric,
      'completed'::text,
      format(
        'Referral bonus from approved deposit. Locked until %s.',
        to_char(rr.locked_until, 'Mon DD, YYYY')
      ),
      rr.created_at
    FROM public.referral_rewards AS rr
    WHERE rr.referrer_user_id = auth.uid()

    UNION ALL

    SELECT
      rl.id,
      'reward'::text,
      rl.amount::numeric,
      coalesce(rl.status, 'completed'),
      coalesce(rl.description, initcap(replace(rl.reward_type, '_', ' '))),
      rl.granted_at
    FROM public.investor_rewards_ledger AS rl
    WHERE rl.user_id = auth.uid()
      AND rl.revoked_at IS NULL
  )
  SELECT
    base.id,
    base.txn_type,
    base.amt,
    base.st,
    base.descr,
    base.ts
  FROM base
  ORDER BY base.ts DESC
  LIMIT greatest(1, least(coalesce(p_limit, 150), 500));
$$;

REVOKE ALL ON FUNCTION public.investor_recent_transactions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_recent_transactions(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Daily jobs: holding streaks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_daily_investment_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locks_matured integer;
  compounded integer;
  holding_updates integer;
BEGIN
  SELECT count(*)::integer
  INTO locks_matured
  FROM public.principal_locks
  WHERE matured = false
    AND locked_until <= NOW();

  PERFORM public.mature_principal_locks(NOW());
  SELECT public.apply_daily_compound_interest() INTO compounded;
  SELECT public.advance_all_holding_streaks() INTO holding_updates;

  RETURN jsonb_build_object(
    'ok', true,
    'ran_at', (NOW() AT TIME ZONE 'UTC'),
    'principal_locks_due', locks_matured,
    'compounded_investors', compounded,
    'holding_streak_updates', holding_updates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_daily_investment_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_daily_investment_jobs() TO service_role;

-- ---------------------------------------------------------------------------
-- Protect loyalty columns from self-edit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investors_prevent_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.balance := OLD.balance;
      NEW.total_profit := OLD.total_profit;
      NEW.locked_principal_balance := OLD.locked_principal_balance;
      NEW.withdrawable_balance := OLD.withdrawable_balance;
      NEW.withdrawable_profit := OLD.withdrawable_profit;
      NEW.withdrawable_principal := OLD.withdrawable_principal;
      NEW.investment_plan := OLD.investment_plan;
      NEW.tier_manual_override := OLD.tier_manual_override;
      NEW.status := OLD.status;
      NEW.email := OLD.email;
      NEW.user_id := OLD.user_id;
      NEW.holding_days_streak := OLD.holding_days_streak;
      NEW.holding_streak_last_date := OLD.holding_streak_last_date;
      NEW.loyalty_tier := OLD.loyalty_tier;
      NEW.merchant_eligible := OLD.merchant_eligible;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.investors_prevent_financial_self_edit() FROM PUBLIC;

-- Referral bonus: append milestone evaluation (preserve existing body from 20260630340000)
CREATE OR REPLACE FUNCTION public.apply_referral_bonus_for_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deposits%ROWTYPE;
  referred_inv public.investors%ROWTYPE;
  referrer_uid uuid;
  referrer_email text;
  referrer_code text;
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

  PERFORM public.evaluate_referral_milestone_rewards(referrer_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_referral_bonus_for_deposit(uuid) FROM PUBLIC;

-- Existing Elite investors: merchant eligibility flag
UPDATE public.investors AS inv
SET merchant_eligible = true
WHERE lower(trim(coalesce(inv.investment_plan, ''))) LIKE '%elite%'
  AND coalesce(inv.merchant_eligible, false) = false;

-- Re-evaluate portfolio milestones after daily compound credits
CREATE OR REPLACE FUNCTION public.apply_daily_compound_interest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_row public.investors%ROWTYPE;
  pct numeric;
  delta numeric;
  min_since interval := interval '23 hours';
  credited integer := 0;
BEGIN
  IF NOT pg_try_advisory_lock(548822671, 928441603) THEN
    RETURN 0;
  END IF;

  BEGIN
    FOR inv_row IN
      SELECT *
      FROM public.investors AS i
      WHERE lower(trim(coalesce(i.status, ''))) = 'active'
        AND coalesce(i.balance, 0) > 0
        AND COALESCE(i.profit_auto_accrue, true)
        AND (
          i.last_compound_at IS NULL
          OR i.last_compound_at <= (NOW() AT TIME ZONE 'UTC') - min_since
        )
      ORDER BY i.id
    LOOP
      pct := public.daily_compound_percent_for_plan(inv_row.investment_plan) / 100.0;
      delta := round(coalesce(inv_row.balance, 0)::numeric * pct, 8);

      IF delta <= 0 THEN
        UPDATE public.investors
        SET last_compound_at = (NOW() AT TIME ZONE 'UTC')
        WHERE id = inv_row.id;
        CONTINUE;
      END IF;

      UPDATE public.investors
      SET
        balance = coalesce(balance, 0)::numeric + delta,
        withdrawable_profit = coalesce(withdrawable_profit, 0)::numeric + delta,
        total_profit = coalesce(total_profit, 0)::numeric + delta,
        last_compound_at = (NOW() AT TIME ZONE 'UTC')
      WHERE id = inv_row.id;

      INSERT INTO public.profits (
        user_id,
        investor_email,
        amount,
        description,
        status,
        profit_origin,
        investment_plan_snapshot
      )
      VALUES (
        inv_row.user_id,
        lower(trim(coalesce(inv_row.email, ''))),
        delta,
        format(
          'Daily compound accrual (%s tier)',
          coalesce(nullif(trim(inv_row.investment_plan), ''), 'current')
        ),
        'completed',
        'compound_daily',
        trim(inv_row.investment_plan)
      );

      IF inv_row.user_id IS NOT NULL THEN
        PERFORM public.evaluate_portfolio_milestone_rewards(inv_row.user_id);
        PERFORM public.sync_investor_loyalty_tier(inv_row.user_id);
      END IF;

      credited := credited + 1;
    END LOOP;

    PERFORM pg_advisory_unlock(548822671, 928441603);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM pg_advisory_unlock(548822671, 928441603);
      RAISE;
  END;

  RETURN credited;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_compound_interest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_daily_compound_interest() TO service_role;
