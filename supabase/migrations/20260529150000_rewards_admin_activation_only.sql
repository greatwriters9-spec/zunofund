-- Rewards visible to investors when eligible; balance credit only after admin activation.

-- ---------------------------------------------------------------------------
-- Pending eligibility queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investor_reward_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investor_email text,
  reward_key text NOT NULL,
  reward_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  badge_key text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_activation',
  eligible_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activated_by uuid,
  CONSTRAINT investor_reward_eligibility_user_key UNIQUE (user_id, reward_key),
  CONSTRAINT investor_reward_eligibility_status_chk CHECK (
    status IN ('pending_activation', 'activated', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS investor_reward_eligibility_pending_idx
  ON public.investor_reward_eligibility (status, eligible_at DESC)
  WHERE status = 'pending_activation';

ALTER TABLE public.investor_reward_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_reward_eligibility_select_own ON public.investor_reward_eligibility;
CREATE POLICY investor_reward_eligibility_select_own
ON public.investor_reward_eligibility
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);

DROP POLICY IF EXISTS investor_reward_eligibility_admin_write ON public.investor_reward_eligibility;
CREATE POLICY investor_reward_eligibility_admin_write
ON public.investor_reward_eligibility
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.reward_program_settings
  ADD COLUMN IF NOT EXISTS require_admin_activation boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Register eligibility (system) — visible to investor, no balance credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_investor_reward_eligibility(
  p_user_id uuid,
  p_reward_key text,
  p_reward_type text,
  p_amount numeric DEFAULT 0,
  p_badge_key text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_notification_type text DEFAULT 'reward_eligible',
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

  INSERT INTO public.investor_reward_eligibility (
    user_id,
    investor_email,
    reward_key,
    reward_type,
    amount,
    badge_key,
    description,
    metadata,
    status
  )
  VALUES (
    p_user_id,
    nullif(inv_email, ''),
    p_reward_key,
    p_reward_type,
    round(greatest(coalesce(p_amount, 0), 0)::numeric, 8),
    nullif(trim(p_badge_key), ''),
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    'pending_activation'
  )
  ON CONFLICT (user_id, reward_key) DO UPDATE
  SET
    amount = EXCLUDED.amount,
    badge_key = EXCLUDED.badge_key,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    eligible_at = now(),
    status = 'pending_activation'
  WHERE public.investor_reward_eligibility.status = 'pending_activation';

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  IF rows_inserted = 0 THEN
    RETURN false;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    p_user_id,
    inv_email,
    coalesce(p_notification_title, 'Reward eligible'),
    coalesce(
      p_notification_message,
      coalesce(p_description, 'You met the requirements for a reward. An admin will activate it shortly.')
    ),
    coalesce(nullif(trim(p_notification_type), ''), 'reward_eligible')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_investor_reward_eligibility(uuid, text, text, numeric, text, text, jsonb, text, text, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Grant reward — admin activation only (credits balance + ledger)
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

  IF p_granted_by IS NULL THEN
    RAISE EXCEPTION 'reward activation requires admin';
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

  UPDATE public.investor_reward_eligibility AS e
  SET
    status = 'activated',
    activated_at = now(),
    activated_by = p_granted_by
  WHERE e.user_id = p_user_id
    AND e.reward_key = p_reward_key
    AND e.status = 'pending_activation';

  IF p_reward_key IN ('tier_pro_elite', 'elite_merchant_benefits')
     OR lower(trim(p_reward_type)) LIKE '%elite%' THEN
    UPDATE public.investors AS inv
    SET merchant_eligible = true
    WHERE inv.user_id = p_user_id;
  END IF;

  PERFORM public.tp_emit_investor_notification(
    p_user_id,
    inv_email,
    coalesce(p_notification_title, 'Reward activated'),
    coalesce(
      p_notification_message,
      coalesce(p_description, format('Your %s reward has been activated.', p_reward_type))
    ),
    coalesce(nullif(trim(p_notification_type), ''), 'reward_unlocked')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_investor_reward(uuid, text, text, numeric, text, text, jsonb, uuid, text, text, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Evaluators → register eligibility (not auto-grant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_portfolio_milestone_rewards(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal numeric;
  cfg public.reward_program_settings;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  cfg := public._reward_settings_row();
  bal := public._investor_balance_for_rewards(p_user_id);

  IF bal >= 5000 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'portfolio_5000', 'portfolio_milestone', 0, 'vip_investor',
      'VIP Investor Badge — $5,000 portfolio milestone',
      jsonb_build_object('portfolio_usd', bal)
    );
  END IF;

  IF bal >= 10000 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'portfolio_10000', 'portfolio_milestone',
      cfg.portfolio_10k_amount, NULL,
      'Portfolio milestone — $10,000 balance bonus',
      jsonb_build_object('portfolio_usd', bal)
    );
  END IF;

  IF bal >= 25000 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'portfolio_25000', 'portfolio_milestone',
      cfg.portfolio_25k_amount, NULL,
      'Portfolio milestone — $25,000 balance bonus',
      jsonb_build_object('portfolio_usd', bal)
    );
  END IF;

  IF bal >= 50000 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'portfolio_50000', 'portfolio_milestone', 0, 'account_manager',
      'Dedicated Account Manager badge — $50,000 portfolio milestone',
      jsonb_build_object('portfolio_usd', bal)
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
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'referral_10', 'referral_milestone', cfg.referral_10_amount, NULL,
      'Referral milestone — 10 active referrals',
      jsonb_build_object('active_referrals', refs),
      'reward_eligible', 'Referral milestone reached',
      'You qualify for the 10-referral reward. An admin will activate it soon.'
    );
  END IF;

  IF refs >= 25 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'referral_25', 'referral_milestone', cfg.referral_25_amount, NULL,
      'Referral milestone — 25 active referrals',
      jsonb_build_object('active_referrals', refs)
    );
  END IF;

  IF refs >= 50 THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'referral_50', 'referral_milestone', 0, 'vip_referral',
      'VIP Referral badge — 50 active referrals',
      jsonb_build_object('active_referrals', refs)
    );
  END IF;

  IF refs >= 100 THEN
    PERFORM public.register_investor_reward_eligibility(
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
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'tier_growth_pro', 'tier_upgrade', cfg.tier_growth_pro_amount, NULL,
      'Tier upgrade reward — Growth to Pro',
      jsonb_build_object('from', p_old_plan, 'to', p_new_plan),
      'reward_eligible', 'Tier upgraded',
      'You qualify for the Growth → Pro reward. An admin will activate it soon.'
    );
  END IF;

  IF old_r = 2 AND new_r = 3 AND lower(trim(p_new_plan)) LIKE '%elite%' THEN
    PERFORM public.register_investor_reward_eligibility(
      p_user_id, 'tier_pro_elite', 'tier_upgrade', cfg.tier_pro_elite_amount, NULL,
      'Tier upgrade reward — Pro to Elite',
      jsonb_build_object('from', p_old_plan, 'to', p_new_plan),
      'reward_eligible', 'Elite tier reached',
      'You qualify for the Pro → Elite reward. An admin will activate it soon.'
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
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.register_investor_reward_eligibility(
    p_user_id,
    'elite_merchant_benefits',
    'elite_benefits',
    0,
    NULL,
    'Elite investor merchant program eligibility',
    jsonb_build_object('benefit', 'merchant_dashboard'),
    'reward_eligible',
    'Elite benefits available',
    'You qualify for Elite merchant benefits. An admin will activate access when approved.'
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

  PERFORM public.register_investor_reward_eligibility(
    p_user_id,
    key,
    'reinvestment_bonus',
    bonus,
    NULL,
    format('Reinvestment bonus (%s%% of deposit)', cfg.reinvestment_bonus_percent::text),
    jsonb_build_object('deposit_id', p_deposit_id, 'deposit_amount', p_deposit_amount),
    'reward_eligible',
    'Reinvestment bonus eligible',
    format('You qualify for a %s%% reinvestment bonus. An admin will activate it soon.', cfg.reinvestment_bonus_percent::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_reinvestment_bonus(uuid, uuid, numeric) FROM PUBLIC;

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
    PERFORM public.register_investor_reward_eligibility(
      p_user_id,
      'holding_30_days',
      'holding_bonus',
      cfg.holding_bonus_amount,
      NULL,
      format('Holding bonus — %s consecutive days with active balance', req_days::text),
      jsonb_build_object('days_held', streak),
      'reward_eligible',
      'Holding bonus eligible',
      format('You completed %s holding days. An admin will activate your $%s bonus.', req_days::text, cfg.holding_bonus_amount::text)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_investor_holding_streak(uuid) FROM PUBLIC;

-- Remove auto merchant_eligible on tier sync (admin activates elite rewards instead)
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

-- ---------------------------------------------------------------------------
-- Admin activate from eligibility queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activate_investor_reward(p_eligibility_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.investor_reward_eligibility%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT *
  INTO row
  FROM public.investor_reward_eligibility
  WHERE id = p_eligibility_id
    AND status = 'pending_activation'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.grant_investor_reward(
    row.user_id,
    row.reward_key,
    row.reward_type,
    row.amount,
    row.badge_key,
    row.description,
    row.metadata,
    auth.uid(),
    'reward_unlocked',
    'Reward activated',
    coalesce(row.description, 'Your reward has been activated and credited.')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_investor_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_investor_reward(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_pending_reward_activations(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  investor_email text,
  reward_key text,
  reward_type text,
  amount numeric,
  badge_key text,
  description text,
  eligible_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.user_id,
    e.investor_email,
    e.reward_key,
    e.reward_type,
    e.amount,
    e.badge_key,
    e.description,
    e.eligible_at
  FROM public.investor_reward_eligibility AS e
  WHERE e.status = 'pending_activation'
    AND public.is_admin(auth.uid())
  ORDER BY e.eligible_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;

REVOKE ALL ON FUNCTION public.admin_list_pending_reward_activations(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_reward_activations(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Investor dashboard: pending + activated
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
  pending_keys text[];
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

  SELECT coalesce(array_agg(e.reward_key), ARRAY[]::text[])
  INTO pending_keys
  FROM public.investor_reward_eligibility AS e
  WHERE e.user_id = uid
    AND e.status = 'pending_activation';

  result := jsonb_build_object(
    'program_enabled', coalesce(cfg.program_enabled, true),
    'require_admin_activation', coalesce(cfg.require_admin_activation, true),
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
    'pending_reward_keys', to_jsonb(pending_keys),
    'pending_rewards', (
      SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.eligible_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          e.id,
          e.reward_key,
          e.reward_type,
          e.amount,
          e.badge_key,
          e.description,
          e.eligible_at
        FROM public.investor_reward_eligibility AS e
        WHERE e.user_id = uid
          AND e.status = 'pending_activation'
        ORDER BY e.eligible_at DESC
      ) AS t
    ),
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
