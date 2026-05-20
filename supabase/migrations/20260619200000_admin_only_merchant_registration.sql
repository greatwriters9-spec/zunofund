-- Merchant onboarding is admin-driven only: no self-service apply RPC or client INSERT.

DROP POLICY IF EXISTS merchant_profiles_insert_own_pending ON public.merchant_profiles;

CREATE OR REPLACE FUNCTION public.admin_register_merchant_candidate(
  p_user_id uuid,
  p_display_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security TO off
AS $$
DECLARE
  st text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.investors AS i WHERE i.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'user must have an investor account first';
  END IF;

  SELECT mp.status INTO st
  FROM public.merchant_profiles mp
  WHERE mp.user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.merchant_profiles (user_id, display_name, status)
    VALUES (
      p_user_id,
      NULLIF(trim(coalesce(p_display_name, '')), ''),
      'pending'
    );
    RETURN;
  END IF;

  IF st = 'active' THEN
    RAISE EXCEPTION 'user is already an active merchant';
  END IF;

  IF st = 'pending' THEN
    IF p_display_name IS NOT NULL AND trim(p_display_name) <> '' THEN
      UPDATE public.merchant_profiles mp
      SET
        display_name = NULLIF(trim(p_display_name), ''),
        updated_at = (NOW() AT TIME ZONE 'UTC')
      WHERE mp.user_id = p_user_id;
    END IF;
    RETURN;
  END IF;

  -- rejected or suspended: invite again → pending
  UPDATE public.merchant_profiles mp
  SET
    status = 'pending',
    display_name = COALESCE(NULLIF(trim(coalesce(p_display_name, '')), ''), mp.display_name),
    applied_at = (NOW() AT TIME ZONE 'UTC'),
    reviewed_at = NULL,
    reviewed_by = NULL,
    review_note = NULL,
    updated_at = (NOW() AT TIME ZONE 'UTC')
  WHERE mp.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_merchant_candidate(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_register_merchant_candidate(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_to_become_merchant(text) FROM authenticated;
