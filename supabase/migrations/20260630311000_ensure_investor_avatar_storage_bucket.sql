-- Ensure profile photo storage exists in deployed environments.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'investor-avatars',
  'investor-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "investor_avatars_select_own" ON storage.objects;
DROP POLICY IF EXISTS "investor_avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "investor_avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "investor_avatars_delete_own" ON storage.objects;

CREATE POLICY "investor_avatars_select_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'investor-avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "investor_avatars_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'investor-avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "investor_avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'investor-avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'investor-avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "investor_avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'investor-avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
);
