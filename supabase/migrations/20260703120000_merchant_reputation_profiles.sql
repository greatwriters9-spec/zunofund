-- Merchant public profiles, reputation (admin-managed), and investor reviews.
-- Does not alter P2P trade / escrow / matching logic.

-- ---------------------------------------------------------------------------
-- merchant_profiles reputation columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS badge_slug text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS about_merchant text,
  ADD COLUMN IF NOT EXISTS member_since timestamptz,
  ADD COLUMN IF NOT EXISTS reputation_total_trades integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_feedback integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_feedback integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neutral_feedback integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric(4, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_rate numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_feedback_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_volume_traded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_release_time_minutes integer,
  ADD COLUMN IF NOT EXISTS avg_payment_time_minutes integer;

COMMENT ON COLUMN public.merchant_profiles.country IS 'Admin-assigned display country (code or name). Merchants cannot edit.';
COMMENT ON COLUMN public.merchant_profiles.badge_slug IS 'Admin-assigned badge slug (verified_merchant, elite_merchant, …).';

-- ---------------------------------------------------------------------------
-- merchant_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.merchant_orders (id) ON DELETE CASCADE,
  merchant_user_id uuid NOT NULL REFERENCES public.merchant_profiles (user_id) ON DELETE CASCADE,
  investor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  moderated_hidden boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS merchant_reviews_merchant_idx
  ON public.merchant_reviews (merchant_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS merchant_reviews_investor_idx
  ON public.merchant_reviews (investor_user_id);

ALTER TABLE public.merchant_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_reviews_select_authenticated ON public.merchant_reviews;
CREATE POLICY merchant_reviews_select_authenticated
  ON public.merchant_reviews
  FOR SELECT
  TO authenticated
  USING (
    NOT moderated_hidden
    OR investor_user_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._masked_reviewer_name(p_full_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(trim(p_full_name), '') = '' THEN 'Anonymous'
    ELSE
      split_part(trim(p_full_name), ' ', 1)
      || CASE
        WHEN position(' ' IN trim(p_full_name)) > 0 THEN
          ' ' || left(split_part(trim(p_full_name), ' ', 2), 1) || '.'
        ELSE ''
      END
  END;
$$;

CREATE OR REPLACE FUNCTION public._sentiment_star_rating(p_sentiment text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_sentiment, '')))
    WHEN 'positive' THEN 5
    WHEN 'neutral' THEN 3
    WHEN 'negative' THEN 1
    ELSE 3
  END;
$$;

-- ---------------------------------------------------------------------------
-- Public merchant profile (investors)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.investor_get_merchant_public_profile(p_merchant_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  country text,
  badge_slug text,
  about_merchant text,
  member_since timestamptz,
  total_trades integer,
  positive_feedback integer,
  negative_feedback integer,
  neutral_feedback integer,
  positive_feedback_percent numeric,
  rating numeric,
  completion_rate numeric,
  total_volume_traded numeric,
  avg_release_time_minutes integer,
  avg_payment_time_minutes integer,
  avatar_url text,
  is_online boolean,
  last_seen_at timestamptz,
  presence_mode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    mp.user_id,
    mp.display_name,
    mp.country,
    mp.badge_slug,
    mp.about_merchant,
    coalesce(mp.member_since, mp.applied_at) AS member_since,
    mp.reputation_total_trades,
    mp.positive_feedback,
    mp.negative_feedback,
    mp.neutral_feedback,
    mp.positive_feedback_percent,
    mp.rating,
    mp.completion_rate,
    mp.total_volume_traded,
    mp.avg_release_time_minutes,
    mp.avg_payment_time_minutes,
    coalesce(
      NULLIF(trim(mp.profile_photo_url::text), ''),
      NULLIF(trim(inv.avatar_url::text), '')
    ) AS avatar_url,
    mp.is_online,
    mp.last_seen_at,
    mp.presence_mode
  FROM public.merchant_profiles mp
  LEFT JOIN public.investors inv ON inv.user_id = mp.user_id
  WHERE mp.user_id = p_merchant_user_id
    AND mp.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.investor_get_merchant_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_get_merchant_public_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_list_merchant_reviews(
  p_merchant_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  sentiment text,
  comment text,
  created_at timestamptz,
  reviewer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    r.id,
    r.sentiment,
    r.comment,
    r.created_at,
    public._masked_reviewer_name(i.full_name) AS reviewer_name
  FROM public.merchant_reviews r
  LEFT JOIN public.investors i ON i.user_id = r.investor_user_id
  INNER JOIN public.merchant_profiles mp
    ON mp.user_id = r.merchant_user_id AND mp.status = 'active'
  WHERE r.merchant_user_id = p_merchant_user_id
    AND NOT r.moderated_hidden
  ORDER BY r.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
$$;

REVOKE ALL ON FUNCTION public.investor_list_merchant_reviews(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_list_merchant_reviews(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_get_merchant_active_offers(p_merchant_user_id uuid)
RETURNS TABLE (
  offer_id uuid,
  side text,
  payment_methods text[],
  min_limit numeric,
  max_limit numeric,
  rate_percentage numeric,
  fiat_currency_code text,
  advert_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    o.id,
    o.side,
    o.payment_methods,
    o.min_limit,
    o.max_limit,
    o.rate_percentage,
    o.fiat_currency_code,
    NULLIF(trim(o.advert_message::text), '') AS advert_message
  FROM public.merchant_offers o
  INNER JOIN public.merchant_profiles mp
    ON mp.user_id = o.merchant_user_id AND mp.status = 'active'
  WHERE o.merchant_user_id = p_merchant_user_id
    AND o.status = 'active'
  ORDER BY o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_get_merchant_active_offers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_get_merchant_active_offers(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_get_order_review_status(p_order_id uuid)
RETURNS TABLE (
  can_review boolean,
  already_reviewed boolean,
  existing_sentiment text,
  existing_comment text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.merchant_orders%ROWTYPE;
  v_review public.merchant_reviews%ROWTYPE;
  v_has_review boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM public.merchant_orders mo WHERE mo.id = p_order_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO v_review FROM public.merchant_reviews mr WHERE mr.order_id = p_order_id;
  v_has_review := FOUND;

  RETURN QUERY SELECT
    (
      v_order.investor_user_id = v_uid
      AND v_order.status = 'completed'
    ),
    v_has_review,
    v_review.sentiment,
    v_review.comment;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_get_order_review_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_get_order_review_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.investor_submit_merchant_review(
  p_order_id uuid,
  p_sentiment text,
  p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.merchant_orders%ROWTYPE;
  v_sentiment text := lower(trim(coalesce(p_sentiment, '')));
  v_review_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_sentiment NOT IN ('positive', 'neutral', 'negative') THEN
    RAISE EXCEPTION 'invalid sentiment';
  END IF;

  SELECT * INTO v_order FROM public.merchant_orders mo WHERE mo.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_order.investor_user_id <> v_uid THEN
    RAISE EXCEPTION 'only the investor on this trade may leave feedback';
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'feedback is only available after trade completion';
  END IF;

  IF EXISTS (SELECT 1 FROM public.merchant_reviews mr WHERE mr.order_id = p_order_id) THEN
    RAISE EXCEPTION 'feedback already submitted for this trade';
  END IF;

  INSERT INTO public.merchant_reviews (
    order_id,
    merchant_user_id,
    investor_user_id,
    sentiment,
    comment
  )
  VALUES (
    p_order_id,
    v_order.merchant_user_id,
    v_uid,
    v_sentiment,
    NULLIF(trim(p_comment), '')
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.investor_submit_merchant_review(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_submit_merchant_review(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin reputation management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_merchant_reputation(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  country text,
  badge_slug text,
  about_merchant text,
  member_since timestamptz,
  reputation_total_trades integer,
  positive_feedback integer,
  negative_feedback integer,
  neutral_feedback integer,
  positive_feedback_percent numeric,
  rating numeric,
  completion_rate numeric,
  total_volume_traded numeric,
  avg_release_time_minutes integer,
  avg_payment_time_minutes integer,
  profile_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    mp.user_id,
    mp.display_name,
    mp.country,
    mp.badge_slug,
    mp.about_merchant,
    coalesce(mp.member_since, mp.applied_at),
    mp.reputation_total_trades,
    mp.positive_feedback,
    mp.negative_feedback,
    mp.neutral_feedback,
    mp.positive_feedback_percent,
    mp.rating,
    mp.completion_rate,
    mp.total_volume_traded,
    mp.avg_release_time_minutes,
    mp.avg_payment_time_minutes,
    mp.profile_photo_url
  FROM public.merchant_profiles mp
  WHERE mp.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_merchant_reputation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_merchant_reputation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_merchant_reputation(
  p_user_id uuid,
  p_country text DEFAULT NULL,
  p_badge_slug text DEFAULT NULL,
  p_about_merchant text DEFAULT NULL,
  p_member_since timestamptz DEFAULT NULL,
  p_reputation_total_trades integer DEFAULT NULL,
  p_positive_feedback integer DEFAULT NULL,
  p_negative_feedback integer DEFAULT NULL,
  p_neutral_feedback integer DEFAULT NULL,
  p_positive_feedback_percent numeric DEFAULT NULL,
  p_rating numeric DEFAULT NULL,
  p_completion_rate numeric DEFAULT NULL,
  p_total_volume_traded numeric DEFAULT NULL,
  p_avg_release_time_minutes integer DEFAULT NULL,
  p_avg_payment_time_minutes integer DEFAULT NULL,
  p_profile_photo_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  UPDATE public.merchant_profiles mp
  SET
    country = coalesce(NULLIF(trim(p_country), ''), mp.country),
    badge_slug = CASE
      WHEN p_badge_slug IS NOT NULL AND trim(p_badge_slug) = '' THEN NULL
      WHEN p_badge_slug IS NOT NULL THEN lower(trim(p_badge_slug))
      ELSE mp.badge_slug
    END,
    about_merchant = CASE
      WHEN p_about_merchant IS NOT NULL THEN NULLIF(trim(p_about_merchant), '')
      ELSE mp.about_merchant
    END,
    member_since = coalesce(p_member_since, mp.member_since),
    reputation_total_trades = coalesce(p_reputation_total_trades, mp.reputation_total_trades),
    positive_feedback = coalesce(p_positive_feedback, mp.positive_feedback),
    negative_feedback = coalesce(p_negative_feedback, mp.negative_feedback),
    neutral_feedback = coalesce(p_neutral_feedback, mp.neutral_feedback),
    positive_feedback_percent = coalesce(p_positive_feedback_percent, mp.positive_feedback_percent),
    rating = coalesce(p_rating, mp.rating),
    completion_rate = coalesce(p_completion_rate, mp.completion_rate),
    total_volume_traded = coalesce(p_total_volume_traded, mp.total_volume_traded),
    avg_release_time_minutes = coalesce(p_avg_release_time_minutes, mp.avg_release_time_minutes),
    avg_payment_time_minutes = coalesce(p_avg_payment_time_minutes, mp.avg_payment_time_minutes),
    profile_photo_url = CASE
      WHEN p_profile_photo_url IS NOT NULL THEN NULLIF(trim(p_profile_photo_url), '')
      ELSE mp.profile_photo_url
    END,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = p_user_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'merchant profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_merchant_reputation(
  uuid, text, text, text, timestamptz, integer, integer, integer, integer,
  numeric, numeric, numeric, numeric, integer, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_merchant_reputation(
  uuid, text, text, text, timestamptz, integer, integer, integer, integer,
  numeric, numeric, numeric, numeric, integer, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_merchant_reviews(p_merchant_user_id uuid)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  sentiment text,
  comment text,
  created_at timestamptz,
  reviewer_name text,
  moderated_hidden boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.order_id,
    r.sentiment,
    r.comment,
    r.created_at,
    public._masked_reviewer_name(i.full_name),
    r.moderated_hidden
  FROM public.merchant_reviews r
  LEFT JOIN public.investors i ON i.user_id = r.investor_user_id
  WHERE r.merchant_user_id = p_merchant_user_id
  ORDER BY r.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_merchant_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_merchant_reviews(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_merchant_review(
  p_review_id uuid,
  p_hidden boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.merchant_reviews
  SET moderated_hidden = coalesce(p_hidden, false)
  WHERE id = p_review_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'review not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_merchant_review(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_merchant_review(uuid, boolean) TO authenticated;

-- Extend admin_merchant_stats with reputation summary columns
DROP FUNCTION IF EXISTS public.admin_merchant_stats();

CREATE OR REPLACE FUNCTION public.admin_merchant_stats()
RETURNS TABLE (
  user_id uuid,
  investor_email text,
  display_name text,
  status text,
  applied_at timestamptz,
  reviewed_at timestamptz,
  order_count bigint,
  completed_count bigint,
  total_volume_usd numeric,
  country text,
  badge_slug text,
  rating numeric,
  positive_feedback_percent numeric,
  reputation_total_trades integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    mp.user_id,
    coalesce(i.email::text, ''),
    mp.display_name,
    mp.status,
    mp.applied_at,
    mp.reviewed_at,
    count(mo.id)::bigint,
    count(mo.id) FILTER (WHERE mo.status = 'completed')::bigint,
    coalesce(
      sum(public._merchant_order_volume_usd(mo)) FILTER (WHERE mo.status IN ('completed', 'paid')),
      0
    )::numeric,
    mp.country,
    mp.badge_slug,
    mp.rating,
    mp.positive_feedback_percent,
    mp.reputation_total_trades
  FROM public.merchant_profiles mp
  LEFT JOIN public.investors i ON i.user_id = mp.user_id
  LEFT JOIN public.merchant_orders mo ON mo.merchant_user_id = mp.user_id
  GROUP BY
    mp.user_id, i.email, mp.display_name, mp.status, mp.applied_at, mp.reviewed_at,
    mp.country, mp.badge_slug, mp.rating, mp.positive_feedback_percent, mp.reputation_total_trades
  ORDER BY coalesce(
    sum(public._merchant_order_volume_usd(mo)) FILTER (WHERE mo.status IN ('completed', 'paid')),
    0
  ) DESC, mp.applied_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merchant_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_merchant_stats() TO authenticated;

-- Marketplace search: include reputation on offer rows
DROP FUNCTION IF EXISTS public.investor_search_merchant_offers(text, numeric, text, text, text);

CREATE FUNCTION public.investor_search_merchant_offers(
  p_side text,
  p_amount numeric DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_fiat_currency_code text DEFAULT NULL,
  p_amount_currency text DEFAULT NULL
)
RETURNS TABLE (
  offer_id uuid,
  merchant_user_id uuid,
  merchant_display_name text,
  merchant_is_online boolean,
  merchant_last_seen_at timestamptz,
  merchant_presence_mode text,
  merchant_avatar_url text,
  merchant_country text,
  merchant_badge_slug text,
  merchant_rating numeric,
  merchant_positive_feedback_percent numeric,
  merchant_total_trades integer,
  merchant_completion_rate numeric,
  side text,
  payment_methods text[],
  min_limit numeric,
  max_limit numeric,
  rate_percentage numeric,
  payment_instructions text,
  advert_message text,
  fiat_currency_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
  SELECT
    o.id,
    o.merchant_user_id,
    mp.display_name,
    mp.is_online,
    mp.last_seen_at,
    mp.presence_mode,
    NULLIF(trim(inv.avatar_url::text), '') AS merchant_avatar_url,
    mp.country,
    mp.badge_slug,
    mp.rating,
    mp.positive_feedback_percent,
    mp.reputation_total_trades,
    mp.completion_rate,
    o.side,
    o.payment_methods,
    o.min_limit,
    o.max_limit,
    o.rate_percentage,
    o.payment_instructions,
    NULLIF(trim(o.advert_message::text), '') AS advert_message,
    o.fiat_currency_code
  FROM public.merchant_offers AS o
  INNER JOIN public.merchant_profiles AS mp
    ON mp.user_id = o.merchant_user_id AND mp.status = 'active'
  LEFT JOIN public.investors AS inv
    ON inv.user_id = o.merchant_user_id
  WHERE o.status = 'active'
    AND o.side = p_side
    AND (
      p_amount IS NULL
      OR (
        public._p2p_to_usd(
          p_amount,
          coalesce(nullif(trim(p_amount_currency), ''), nullif(trim(p_fiat_currency_code), ''), o.fiat_currency_code)
        )
        >= public._p2p_to_usd(o.min_limit, o.fiat_currency_code)
        AND public._p2p_to_usd(
          p_amount,
          coalesce(nullif(trim(p_amount_currency), ''), nullif(trim(p_fiat_currency_code), ''), o.fiat_currency_code)
        )
        <= public._p2p_to_usd(o.max_limit, o.fiat_currency_code)
      )
    )
    AND (
      p_payment_method IS NULL
      OR trim(p_payment_method) = ''
      OR p_payment_method = ANY (o.payment_methods)
    )
    AND (
      p_fiat_currency_code IS NULL
      OR trim(p_fiat_currency_code) = ''
      OR upper(p_fiat_currency_code) = o.fiat_currency_code
    )
  ORDER BY
    public._merchant_is_effectively_online(mp.is_online, mp.last_seen_at, mp.presence_mode) DESC,
    o.rate_percentage ASC,
    o.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_search_merchant_offers(text, numeric, text, text, text) TO authenticated;
