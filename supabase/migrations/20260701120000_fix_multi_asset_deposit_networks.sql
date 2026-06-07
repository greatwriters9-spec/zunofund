-- Fix: 20260630290000_admin_editable_deposit_networks.sql reverted the RPC to USDT/BTC only.
-- Re-expand asset support and restore multi-asset admin_replace_platform_deposit_networks.

ALTER TABLE public.platform_deposit_networks
  DROP CONSTRAINT IF EXISTS platform_deposit_networks_asset_check;

ALTER TABLE public.platform_deposit_networks
  ADD CONSTRAINT platform_deposit_networks_asset_check
  CHECK (
    upper(trim(asset)) IN (
      'BTC',
      'ETH',
      'USDT',
      'USDC',
      'BNB',
      'SOL',
      'XRP',
      'DOGE',
      'TRX',
      'LTC'
    )
  );

-- Align legacy seed network code with UI presets.
UPDATE public.platform_deposit_networks
SET network_name = 'BEP20'
WHERE upper(trim(asset)) = 'USDT'
  AND lower(trim(network_name)) IN ('bsc', 'bep20');

CREATE OR REPLACE FUNCTION public.admin_replace_platform_deposit_networks(p_items jsonb)
RETURNS SETOF public.platform_deposit_networks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected integer;
  v_inserted integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'deposit network payload must be an array';
  END IF;

  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'deposit network payload is too large';
  END IF;

  SELECT count(*)::integer
  INTO v_expected
  FROM jsonb_array_elements(p_items) AS payload(item)
  WHERE upper(trim(coalesce(item->>'asset', ''))) IN (
      'BTC',
      'ETH',
      'USDT',
      'USDC',
      'BNB',
      'SOL',
      'XRP',
      'DOGE',
      'TRX',
      'LTC'
    )
    AND trim(coalesce(item->>'network_name', '')) <> ''
    AND trim(coalesce(item->>'wallet_address', '')) <> '';

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
  WHERE upper(trim(coalesce(item->>'asset', ''))) IN (
      'BTC',
      'ETH',
      'USDT',
      'USDC',
      'BNB',
      'SOL',
      'XRP',
      'DOGE',
      'TRX',
      'LTC'
    )
    AND trim(coalesce(item->>'network_name', '')) <> ''
    AND trim(coalesce(item->>'wallet_address', '')) <> ''
  ORDER BY ord;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted <> v_expected THEN
    RAISE EXCEPTION 'Failed to save all wallets (% saved of %). Check for duplicate asset/network pairs.', v_inserted, v_expected;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.platform_deposit_networks
  ORDER BY sort_order, asset, network_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_platform_deposit_networks(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_platform_deposit_networks(jsonb) TO authenticated;
