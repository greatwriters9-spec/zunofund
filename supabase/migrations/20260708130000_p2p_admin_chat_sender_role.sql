-- Admin mediation messages must stay sender_role = admin even when the admin account
-- is also listed as a party on the trade (e.g. testing). Explicit admin role wins.

CREATE OR REPLACE FUNCTION public.merchant_order_messages_before_insert_set_sender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sender_user_id := auth.uid();
  IF NEW.sender_user_id IS NULL THEN
    RAISE EXCEPTION 'merchant_order_messages requires authentication';
  END IF;

  IF coalesce(trim(NEW.sender_role), '') = 'system' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(NEW.sender_user_id)
     AND coalesce(nullif(trim(NEW.sender_role), ''), 'admin') = 'admin' THEN
    NEW.sender_role := 'admin';
    RETURN NEW;
  END IF;

  NEW.sender_role := 'party';
  RETURN NEW;
END;
$$;
