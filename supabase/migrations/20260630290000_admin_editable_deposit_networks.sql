-- Admin-editable deposit wallet networks for exchange deposits.

CREATE TABLE IF NOT EXISTS public.platform_deposit_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset text NOT NULL CHECK (upper(trim(asset)) IN ('USDT', 'BTC')),
  network_name text NOT NULL CHECK (length(trim(network_name)) > 0),
  network_label text NOT NULL DEFAULT '',
  wallet_address text NOT NULL CHECK (length(trim(wallet_address)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.platform_deposit_networks
  ADD COLUMN IF NOT EXISTS network_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS platform_deposit_networks_asset_network_idx
  ON public.platform_deposit_networks (upper(trim(asset)), lower(trim(network_name)));

INSERT INTO public.platform_deposit_networks (
  asset,
  network_name,
  network_label,
  wallet_address,
  sort_order,
  is_active
)
SELECT seed.asset, seed.network_name, seed.network_label, seed.wallet_address, seed.sort_order, true
FROM (
  VALUES
    (
      'USDT',
      'TRC20',
      'TRC20',
      'TAuiPnSkC3KsacnPQpJ8b55mbUoCoDzBg5',
      0
    ),
    (
      'USDT',
      'BSC',
      'BNB Smart Chain (BEP20)',
      '0x48fd2fb89e12ce3d91430319da5616a0df869ccf',
      1
    ),
    (
      'BTC',
      'Bitcoin',
      'Bitcoin',
      '1P7RWfvSawJBicW3jocUPUCmat4HhBALF9',
      2
    )
) AS seed(asset, network_name, network_label, wallet_address, sort_order)
ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_deposit_networks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_deposit_networks_select ON public.platform_deposit_networks;
CREATE POLICY platform_deposit_networks_select
  ON public.platform_deposit_networks
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
  );

REVOKE ALL ON public.platform_deposit_networks FROM PUBLIC;
GRANT SELECT ON public.platform_deposit_networks TO anon, authenticated;

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS deposit_network text,
  ADD COLUMN IF NOT EXISTS deposit_wallet_address text;

CREATE OR REPLACE FUNCTION public.admin_replace_platform_deposit_networks(p_items jsonb)
RETURNS SETOF public.platform_deposit_networks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'deposit network payload must be an array';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'deposit network payload is too large';
  END IF;

  DELETE FROM public.platform_deposit_networks WHERE true;

  INSERT INTO public.platform_deposit_networks (
    asset,
    network_name,
    network_label,
    wallet_address,
    sort_order,
    is_active,
    updated_by
  )
  SELECT
    upper(trim(item->>'asset')),
    trim(item->>'network_name'),
    trim(coalesce(item->>'network_label', '')),
    trim(item->>'wallet_address'),
    (ord - 1)::integer,
    CASE
      WHEN jsonb_typeof(item->'is_active') = 'boolean'
        THEN (item->>'is_active')::boolean
      ELSE true
    END,
    auth.uid()
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS payload(item, ord)
  WHERE upper(trim(coalesce(item->>'asset', ''))) IN ('USDT', 'BTC')
    AND trim(coalesce(item->>'network_name', '')) <> ''
    AND trim(coalesce(item->>'wallet_address', '')) <> ''
  ORDER BY ord;

  RETURN QUERY
  SELECT *
  FROM public.platform_deposit_networks
  ORDER BY sort_order, asset, network_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_platform_deposit_networks(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_platform_deposit_networks(jsonb) TO authenticated;
