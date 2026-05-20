-- Only allow investors to create their own profile in pending state (admin promotes to active).
DROP POLICY IF EXISTS merchant_profiles_insert_own_pending ON public.merchant_profiles;

CREATE POLICY merchant_profiles_insert_own_pending
ON public.merchant_profiles FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
);
