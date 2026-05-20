-- Per-order trade chat: investor + merchant can read history; inserts only while order is pending_payment or paid.
-- Wired in Next `/p2p/order/[id]` via Supabase + Realtime (publication added below).

CREATE TABLE public.merchant_order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.merchant_orders (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  CONSTRAINT merchant_order_messages_body_len CHECK (
    length(trim(body)) >= 1
    AND length(body) <= 2000
  )
);

CREATE INDEX merchant_order_messages_order_created_idx ON public.merchant_order_messages (order_id, created_at ASC);

ALTER TABLE public.merchant_order_messages ENABLE ROW LEVEL SECURITY;

-- Always stamp sender from the session (clients send only order_id + body).
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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_order_messages_before_insert_set_sender() FROM PUBLIC;

DROP TRIGGER IF EXISTS merchant_order_messages_bi_set_sender ON public.merchant_order_messages;

CREATE TRIGGER merchant_order_messages_bi_set_sender
BEFORE INSERT ON public.merchant_order_messages
FOR EACH ROW
EXECUTE FUNCTION public.merchant_order_messages_before_insert_set_sender();

CREATE POLICY merchant_order_messages_select_party
ON public.merchant_order_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.merchant_orders mo
    WHERE
      mo.id = merchant_order_messages.order_id
      AND (
        mo.investor_user_id = auth.uid()
        OR mo.merchant_user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  )
);

CREATE POLICY merchant_order_messages_insert_party
ON public.merchant_order_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      public.merchant_orders mo
    WHERE
      mo.id = merchant_order_messages.order_id
      AND (
        mo.investor_user_id = auth.uid()
        OR mo.merchant_user_id = auth.uid()
      )
      AND mo.status IN ('pending_payment', 'paid')
  )
);

-- Supabase Realtime (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_order_messages';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
