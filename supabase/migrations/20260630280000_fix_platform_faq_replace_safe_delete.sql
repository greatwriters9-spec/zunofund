-- pg-safeupdate rejects DELETE statements without a WHERE clause.
-- Keep FAQ replacement behavior, but make the full-table delete explicit.

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
