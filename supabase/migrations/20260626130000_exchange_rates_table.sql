-- FX rate cache for the multi-currency display layer.
--
-- Convention: `usd_value` = how many USD equal **one unit** of `code`.
--   USD = 1 (baseline), USDT = 1 (peg), KES ≈ 0.00775, BTC ≈ 70000, etc.
--
-- This makes the math symmetric:
--   usd_amount = native_amount * usd_value(code)
--   native_amount = usd_amount / usd_value(code)
--
-- The table is seeded with reasonable starting values so the UI never
-- shows zero before the first refresh. The cron route
-- `/api/cron/refresh-fx-rates` upserts live numbers from CoinGecko
-- (USDT/BTC/ETH → USD) and open.er-api.com (USD → fiats).

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  code text PRIMARY KEY
    CHECK (code = upper(code) AND length(code) BETWEEN 3 AND 5),
  usd_value numeric NOT NULL
    CHECK (usd_value > 0),
  source text NOT NULL DEFAULT 'manual',
  fetched_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

COMMENT ON TABLE public.exchange_rates IS
  'Cache of FX rates. usd_value = how many USD equal 1 unit of `code`. USD itself is seeded as 1.';
COMMENT ON COLUMN public.exchange_rates.usd_value IS
  'USD value of one unit of `code`. e.g. KES ≈ 0.0078, BTC ≈ 70000, USD = 1.';
COMMENT ON COLUMN public.exchange_rates.source IS
  'Where the rate came from (coingecko, open-er-api, manual, baseline).';

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_read_anyone" ON public.exchange_rates;
CREATE POLICY "exchange_rates_read_anyone"
  ON public.exchange_rates
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.exchange_rates_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now() AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exchange_rates_touch_updated_at ON public.exchange_rates;
CREATE TRIGGER exchange_rates_touch_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.exchange_rates_touch_updated_at();

INSERT INTO public.exchange_rates (code, usd_value, source)
VALUES
  ('USD',  1,         'baseline'),
  ('USDT', 1,         'baseline'),
  ('EUR',  1.0870,    'seed'),
  ('GBP',  1.2660,    'seed'),
  ('JPY',  0.0064,    'seed'),
  ('CNY',  0.1380,    'seed'),
  ('INR',  0.0118,    'seed'),
  ('AED',  0.2723,    'seed'),
  ('CHF',  1.1140,    'seed'),
  ('AUD',  0.6580,    'seed'),
  ('CAD',  0.7320,    'seed'),
  ('KES',  0.00775,   'seed'),
  ('UGX',  0.000270,  'seed'),
  ('TZS',  0.000380,  'seed'),
  ('RWF',  0.000760,  'seed'),
  ('ETB',  0.0078,    'seed'),
  ('NGN',  0.000625,  'seed'),
  ('GHS',  0.0656,    'seed'),
  ('ZAR',  0.0540,    'seed'),
  ('ZMW',  0.0383,    'seed'),
  ('EGP',  0.0205,    'seed'),
  ('MAD',  0.1001,    'seed'),
  ('XOF',  0.001660,  'seed'),
  ('XAF',  0.001660,  'seed'),
  ('BTC',  70000,     'seed')
ON CONFLICT (code) DO NOTHING;

GRANT SELECT ON public.exchange_rates TO anon, authenticated;
