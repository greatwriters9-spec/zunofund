-- Bell badge unread total must mirror "my" notifications only.
-- Notifications SELECT policy lets admins see all rows; SECURITY INVOKER COUNT(*)
-- therefore summed every unread row in the system while the dashboard only
-- fetches `.or(user_id.eq.<me>,investor_email.ilike.<me>)`.
-- Bypass RLS in this aggregate and enforce the same ownership predicate explicitly.

CREATE OR REPLACE FUNCTION public.investor_unread_notifications_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COUNT(*)::bigint
  FROM public.notifications AS n
  WHERE (
    n.user_id = auth.uid()
    OR lower(trim(n.investor_email))
      IS NOT DISTINCT FROM lower(trim(public.request_email()))
  )
    AND (n.is_read IS NOT TRUE)
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.investor_unread_notifications_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_unread_notifications_count() TO authenticated;
