-- Single-email signup strategy with confirm-email still ON:
-- Only Supabase Auth sends "Confirm signup" (contains the verification link).
-- Remove the trigger-inserted notification that duplicated messaging via webhook/Resend.
-- Brand that one mail in Dashboard → Authentication → Email templates → Confirm signup.

CREATE OR REPLACE FUNCTION public.sync_investor_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  fn text := NULLIF(trim(meta->>'first_name'), '');
  mn text := NULLIF(trim(meta->>'middle_name'), '');
  sn text := NULLIF(trim(meta->>'surname'), '');
  full_nm text := NULLIF(trim(meta->>'full_name'), '');
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
    status
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
    'active'
  );

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'sync_investor_profile_from_auth_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
