-- Admin-editable FAQs shown on the public contact page.

CREATE TABLE IF NOT EXISTS public.platform_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (length(trim(question)) > 0),
  answer text NOT NULL CHECK (length(trim(answer)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.platform_faqs (question, answer, sort_order, is_active)
SELECT seed.question, seed.answer, seed.sort_order, true
FROM (
  VALUES
    (
      'How long do withdrawals take?',
      'Withdrawal processing times depend on verification and blockchain confirmation speed. Most requests are processed within a short timeframe after approval.',
      0
    ),
    (
      'Is investor support available every day?',
      'Yes. Our support team operates 24/7 to ensure continuous assistance for investors worldwide.',
      1
    ),
    (
      'How do I begin investing?',
      'Create an account, choose your preferred investment plan, and proceed with your deposit request through the secure investor dashboard.',
      2
    )
) AS seed(question, answer, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_faqs);

ALTER TABLE public.platform_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_faqs_select ON public.platform_faqs;
CREATE POLICY platform_faqs_select
  ON public.platform_faqs
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
  );

REVOKE ALL ON public.platform_faqs FROM PUBLIC;
GRANT SELECT ON public.platform_faqs TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_replace_platform_faqs(p_items jsonb)
RETURNS SETOF public.platform_faqs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'FAQ payload must be an array';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'FAQ payload is too large';
  END IF;

  DELETE FROM public.platform_faqs WHERE true;

  INSERT INTO public.platform_faqs (
    question,
    answer,
    sort_order,
    is_active,
    updated_by
  )
  SELECT
    trim(item->>'question'),
    trim(item->>'answer'),
    (ord - 1)::integer,
    CASE
      WHEN jsonb_typeof(item->'is_active') = 'boolean'
        THEN (item->>'is_active')::boolean
      ELSE true
    END,
    auth.uid()
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS payload(item, ord)
  WHERE trim(coalesce(item->>'question', '')) <> ''
    AND trim(coalesce(item->>'answer', '')) <> ''
  ORDER BY ord;

  RETURN QUERY
  SELECT *
  FROM public.platform_faqs
  ORDER BY sort_order, question;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_platform_faqs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_platform_faqs(jsonb) TO authenticated;
