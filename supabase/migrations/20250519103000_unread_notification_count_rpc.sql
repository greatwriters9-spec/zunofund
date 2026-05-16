-- Accurate unread count aligned with investor RLS visibility (fixes bell badge totals).
CREATE OR REPLACE FUNCTION public.investor_unread_notifications_count()
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.notifications AS n
  WHERE (
    n.user_id = auth.uid()
    OR lower(trim(n.investor_email))
      IS NOT DISTINCT FROM lower(trim(public.request_email()))
  )
    AND (n.is_read IS NOT TRUE);
$$;

REVOKE ALL ON FUNCTION public.investor_unread_notifications_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_unread_notifications_count() TO authenticated;
