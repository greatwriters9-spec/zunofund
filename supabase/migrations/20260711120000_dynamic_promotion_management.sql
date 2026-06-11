-- Dynamic promotion management: investment plans, promotion settings, announcements.

CREATE TABLE IF NOT EXISTS public.investment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_deposit numeric NOT NULL CHECK (min_deposit >= 0),
  max_deposit numeric NOT NULL CHECK (max_deposit > 0),
  daily_roi numeric NOT NULL CHECK (daily_roi > 0),
  promotion_return_target numeric NOT NULL CHECK (promotion_return_target > 0),
  promotion_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  CONSTRAINT investment_plans_name_unique UNIQUE (name),
  CONSTRAINT investment_plans_deposit_range CHECK (max_deposit >= min_deposit)
);

CREATE TABLE IF NOT EXISTS public.promotion_settings (
  id uuid PRIMARY KEY DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid,
  promotion_title text NOT NULL DEFAULT 'Partner Promotion Active',
  promotion_description text,
  promotion_end_date timestamptz NOT NULL DEFAULT '2027-01-01 00:00:00+00',
  partner_fund_amount numeric,
  show_countdown boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  CONSTRAINT announcements_category_check CHECK (
    category IN (
      'Promotion Updates',
      'Trading Performance',
      'Platform News',
      'Community Growth',
      'Important Notices'
    )
  )
);

CREATE INDEX IF NOT EXISTS investment_plans_sort_order_idx
  ON public.investment_plans (sort_order ASC);

CREATE INDEX IF NOT EXISTS announcements_created_at_idx
  ON public.announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS announcements_featured_idx
  ON public.announcements (featured, created_at DESC)
  WHERE featured = true AND published = true;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := (NOW() AT TIME ZONE 'UTC');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investment_plans_touch_updated_at ON public.investment_plans;
CREATE TRIGGER investment_plans_touch_updated_at
  BEFORE UPDATE ON public.investment_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS promotion_settings_touch_updated_at ON public.promotion_settings;
CREATE TRIGGER promotion_settings_touch_updated_at
  BEFORE UPDATE ON public.promotion_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investment_plans_public_select ON public.investment_plans;
CREATE POLICY investment_plans_public_select
  ON public.investment_plans FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS investment_plans_admin_all ON public.investment_plans;
CREATE POLICY investment_plans_admin_all
  ON public.investment_plans FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS promotion_settings_public_select ON public.promotion_settings;
CREATE POLICY promotion_settings_public_select
  ON public.promotion_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS promotion_settings_admin_all ON public.promotion_settings;
CREATE POLICY promotion_settings_admin_all
  ON public.promotion_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS announcements_public_select ON public.announcements;
CREATE POLICY announcements_public_select
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (published = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS announcements_admin_all ON public.announcements;
CREATE POLICY announcements_admin_all
  ON public.announcements FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.investment_plans TO anon, authenticated;
GRANT SELECT ON public.promotion_settings TO anon, authenticated;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.investment_plans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotion_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

-- Seed investment plans (aligned with current platform rates; admin can edit live).
INSERT INTO public.investment_plans (name, min_deposit, max_deposit, daily_roi, promotion_return_target, promotion_active, sort_order)
SELECT * FROM (VALUES
  ('Starter'::text, 20::numeric, 499.99::numeric, 10::numeric, 500::numeric, true, 1),
  ('Growth', 500, 1499.99, 20, 1500, true, 2),
  ('Pro', 1500, 4999.99, 30, 3000, true, 3),
  ('Elite', 5000, 999999999, 50, 10000, true, 4)
) AS seed(name, min_deposit, max_deposit, daily_roi, promotion_return_target, promotion_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.investment_plans LIMIT 1);

INSERT INTO public.promotion_settings (
  id,
  promotion_title,
  promotion_description,
  promotion_end_date,
  partner_fund_amount,
  show_countdown,
  is_active
)
SELECT
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Partner Promotion Active',
  'Promotional partner fund allocations are active across all investment tiers.',
  '2027-01-01 00:00:00+00'::timestamptz,
  NULL::numeric,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.promotion_settings LIMIT 1);

INSERT INTO public.announcements (title, content, category, featured, published, created_at)
SELECT title, content, category, featured, true, created_at
FROM public.investor_announcements
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investor_announcements')
  AND NOT EXISTS (SELECT 1 FROM public.announcements LIMIT 1);

INSERT INTO public.announcements (title, content, category, featured, published, created_at)
SELECT * FROM (VALUES
  (
    'Trading Volume Growth Update'::text,
    'Our partner network has expanded and platform trading volume continues to grow. Promotional incentives remain active while additional opportunities are being evaluated.'::text,
    'Promotion Updates'::text,
    true,
    true,
    '2026-06-01 00:00:00+00'::timestamptz
  ),
  (
    'Communication Center Launch',
    'The Zuno Communication Center is now live. Official announcements, promotion updates, and platform news will be published here by Zuno Administration.',
    'Platform News',
    false,
    true,
    '2026-06-08 00:00:00+00'::timestamptz
  )
) AS seed(title, content, category, featured, published, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.announcements LIMIT 1);

-- Read tier config from investment_plans (admin-editable).
CREATE OR REPLACE FUNCTION public.daily_compound_percent_for_plan(plan text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT ip.daily_roi
      FROM public.investment_plans AS ip
      WHERE lower(trim(coalesce(plan, ''))) LIKE '%' || lower(ip.name) || '%'
      ORDER BY ip.sort_order DESC
      LIMIT 1
    ),
    10::numeric
  );
$$;

CREATE OR REPLACE FUNCTION public.investment_plan_slug_for_principal(p_usd numeric)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT ip.name
      FROM public.investment_plans AS ip
      WHERE coalesce(p_usd, 0) >= ip.min_deposit
        AND coalesce(p_usd, 0) <= ip.max_deposit
      ORDER BY ip.sort_order DESC
      LIMIT 1
    ),
    (
      SELECT ip.name
      FROM public.investment_plans AS ip
      ORDER BY ip.sort_order ASC
      LIMIT 1
    ),
    'Starter'
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_min_deposit_usd()
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(min(ip.min_deposit), 100::numeric)
  FROM public.investment_plans AS ip
  WHERE ip.promotion_active = true;
$$;

CREATE OR REPLACE FUNCTION public.deposits_before_insert_validate_plan_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
  min_usd numeric;
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

  min_usd := public.platform_min_deposit_usd();

  IF NEW.amount::numeric < min_usd THEN
    RAISE EXCEPTION
      'deposit amount must be at least % USD', min_usd
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Interest floor follows lowest active plan minimum (rest of accrual logic unchanged).
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
  min_principal numeric;
BEGIN
  min_principal := public.platform_min_deposit_usd();

  IF NOT pg_try_advisory_lock(548822671, 928441603) THEN
    RETURN 0;
  END IF;

  BEGIN
    FOR inv_row IN
      SELECT *
      FROM public.investors AS i
      WHERE lower(trim(coalesce(i.status, ''))) = 'active'
        AND coalesce(i.balance, 0) > 0
        AND coalesce(i.tier_qualifying_principal, 0) >= min_principal
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

REVOKE ALL ON FUNCTION public.platform_min_deposit_usd() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_min_deposit_usd() TO anon, authenticated;
