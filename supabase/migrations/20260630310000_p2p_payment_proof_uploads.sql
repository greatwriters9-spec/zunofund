-- Private P2P payment screenshot bucket + chat message attachment fields.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'p2p-payment-proofs',
  'p2p-payment-proofs',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

ALTER TABLE public.merchant_order_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime_type text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

ALTER TABLE public.merchant_order_messages
  DROP CONSTRAINT IF EXISTS merchant_order_messages_body_len;

ALTER TABLE public.merchant_order_messages
  ADD CONSTRAINT merchant_order_messages_body_or_attachment_chk CHECK (
    (
      length(trim(coalesce(body, ''))) >= 1
      AND length(body) <= 2000
    )
    OR length(trim(coalesce(attachment_path, ''))) >= 1
  );

DROP POLICY IF EXISTS "p2p_payment_proofs_select_party" ON storage.objects;
DROP POLICY IF EXISTS "p2p_payment_proofs_insert_party" ON storage.objects;
DROP POLICY IF EXISTS "p2p_payment_proofs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "p2p_payment_proofs_delete_own" ON storage.objects;

CREATE POLICY "p2p_payment_proofs_select_party"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'p2p-payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.merchant_orders mo
    WHERE mo.id::text = split_part(storage.objects.name, '/', 1)
      AND (
        mo.investor_user_id = auth.uid()
        OR mo.merchant_user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  )
);

CREATE POLICY "p2p_payment_proofs_insert_party"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'p2p-payment-proofs'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.merchant_orders mo
    WHERE mo.id::text = split_part(storage.objects.name, '/', 1)
      AND (
        mo.investor_user_id = auth.uid()
        OR mo.merchant_user_id = auth.uid()
      )
      AND mo.status IN ('pending_payment', 'paid')
  )
);

CREATE POLICY "p2p_payment_proofs_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'p2p-payment-proofs'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'p2p-payment-proofs'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
);

CREATE POLICY "p2p_payment_proofs_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'p2p-payment-proofs'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
);
