-- Singleton platform contact info (admin-editable, public read).

CREATE TABLE IF NOT EXISTS public.platform_contact_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  support_email text NOT NULL DEFAULT '',
  support_phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  telegram text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.platform_contact_settings (id, support_email, support_phone, whatsapp, telegram)
VALUES (
  'default',
  'support@zunofund.com',
  '+254 797 674 560',
  '+254 797 674 560',
  '@ZUNO_SUPPORT'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_contact_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_contact_settings_select ON public.platform_contact_settings;
CREATE POLICY platform_contact_settings_select
  ON public.platform_contact_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.platform_contact_settings FROM PUBLIC;
GRANT SELECT ON public.platform_contact_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_platform_contact(
  p_support_email text,
  p_support_phone text,
  p_whatsapp text,
  p_telegram text
)
RETURNS public.platform_contact_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.platform_contact_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.platform_contact_settings
  SET
    support_email = trim(coalesce(p_support_email, '')),
    support_phone = trim(coalesce(p_support_phone, '')),
    whatsapp = trim(coalesce(p_whatsapp, '')),
    telegram = trim(coalesce(p_telegram, '')),
    updated_at = (NOW() AT TIME ZONE 'UTC'),
    updated_by = auth.uid()
  WHERE id = 'default'
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact settings missing';
  END IF;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_platform_contact(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_contact(text, text, text, text) TO authenticated;
