-- Extend effective-online window to 5 minutes (matches client MERCHANT_PRESENCE_STALE_MS).

CREATE OR REPLACE FUNCTION public._merchant_is_effectively_online(
  p_is_online boolean,
  p_last_seen_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_is_online, false)
    AND p_last_seen_at IS NOT NULL
    AND p_last_seen_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '5 minutes';
$$;

REVOKE ALL ON FUNCTION public._merchant_is_effectively_online(boolean, timestamptz) FROM PUBLIC;
