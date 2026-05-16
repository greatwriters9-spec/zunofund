-- Allow investors to mark notifications read when the row matched by email only
-- (legacy / admin-insert paths may leave user_id NULL while investor_email is set).

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR lower(trim(investor_email)) IS NOT DISTINCT FROM public.request_email()
);
