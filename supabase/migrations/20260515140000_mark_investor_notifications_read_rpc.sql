-- Reliable mark-read for investors matching "my rows" predicate (JWT uid + normalized email).
-- Mirrors investor_unread_notifications_count ownership; bypasses brittle UPDATE+RETURNING/RLS quirks.

CREATE OR REPLACE FUNCTION public.mark_investor_notifications_read(p_ids uuid[])
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_updated bigint := 0;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.notifications AS n
  SET is_read = true
  WHERE n.id = ANY (p_ids)
    AND (
      n.user_id = auth.uid()
      OR lower(trim(n.investor_email))
        IS NOT DISTINCT FROM lower(trim(public.request_email()))
    )
    AND (n.is_read IS NOT TRUE);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_investor_notifications_read(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_investor_notifications_read(uuid[]) TO authenticated;
