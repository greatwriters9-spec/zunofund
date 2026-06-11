-- Official investor announcements for Communication Center + dashboard featured preview.

CREATE TABLE IF NOT EXISTS public.investor_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  featured boolean NOT NULL DEFAULT false,
  CONSTRAINT investor_announcements_category_check CHECK (
    category IN (
      'Promotion Updates',
      'Trading Performance',
      'Platform News',
      'Community Growth',
      'Important Notices'
    )
  )
);

CREATE INDEX IF NOT EXISTS investor_announcements_created_at_idx
  ON public.investor_announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS investor_announcements_featured_idx
  ON public.investor_announcements (featured, created_at DESC)
  WHERE featured = true;

ALTER TABLE public.investor_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_announcements_select_authenticated
  ON public.investor_announcements;
CREATE POLICY investor_announcements_select_authenticated
  ON public.investor_announcements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS investor_announcements_admin_all
  ON public.investor_announcements;
CREATE POLICY investor_announcements_admin_all
  ON public.investor_announcements
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.investor_announcements TO authenticated;

INSERT INTO public.investor_announcements (title, category, content, created_at, featured)
SELECT * FROM (VALUES
  (
    'Trading Volume Growth Update'::text,
    'Promotion Updates'::text,
    'Our partner network has expanded and platform trading volume continues to grow. Promotional incentives remain active while additional opportunities are being evaluated.'::text,
    '2026-06-01 00:00:00+00'::timestamptz,
    true
  ),
  (
    'Partner Promotion Active',
    'Promotion Updates',
    'Promotional partner fund allocations are active across Starter, Growth, Pro, and Elite tiers through January 1, 2027. Rates are reviewed periodically based on trading activity and platform growth.',
    '2026-05-15 00:00:00+00',
    false
  ),
  (
    'Market Activity Summary',
    'Trading Performance',
    'Supported markets continue to show steady participation from merchants and investors. Volume growth supports ongoing promotional eligibility reviews.',
    '2026-05-01 00:00:00+00',
    false
  ),
  (
    'Communication Center Launch',
    'Platform News',
    'The Zuno Communication Center is now live. Official announcements, promotion updates, and platform news will be published here by Zuno Administration.',
    '2026-06-08 00:00:00+00',
    false
  ),
  (
    'Community Growth Milestone',
    'Community Growth',
    'Thank you to our growing investor community. Increased participation helps unlock additional promotional opportunities and campaign extensions over time.',
    '2026-04-20 00:00:00+00',
    false
  ),
  (
    'Promotional Rate Review Policy',
    'Important Notices',
    'Promotional rates and campaign duration are reviewed periodically based on trading activity, platform growth, market conditions, and partner participation. All updates will be communicated through this center.',
    '2026-04-01 00:00:00+00',
    false
  )
) AS seed(title, category, content, created_at, featured)
WHERE NOT EXISTS (SELECT 1 FROM public.investor_announcements LIMIT 1);
