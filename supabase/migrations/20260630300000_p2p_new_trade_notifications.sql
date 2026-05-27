-- Notify merchants when an investor opens a new P2P trade against their offer.

CREATE OR REPLACE FUNCTION public._format_p2p_asset_amount(
  p_asset text,
  p_amount numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN upper(trim(coalesce(p_asset, ''))) = 'BTC'
      THEN to_char(round(coalesce(p_amount, 0)::numeric, 8), 'FM999999999999990.00000000') || ' BTC'
    ELSE public._format_money_display(p_amount) || ' USDT'
  END;
$$;

CREATE OR REPLACE FUNCTION public.tp_notify_p2p_merchant_order_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  merchant_email text := '';
  investor_label text := 'An investor';
  asset text;
  amount_label text;
  action_label text;
  fiat_label text := '';
BEGIN
  SELECT lower(trim(coalesce(i.email, '')))
  INTO merchant_email
  FROM public.investors AS i
  WHERE i.user_id = NEW.merchant_user_id
  LIMIT 1;

  IF coalesce(merchant_email, '') = '' THEN
    SELECT lower(trim(coalesce(u.email, '')))
    INTO merchant_email
    FROM auth.users AS u
    WHERE u.id = NEW.merchant_user_id
    LIMIT 1;
  END IF;

  SELECT coalesce(nullif(trim(i.full_name), ''), nullif(trim(i.email), ''))
  INTO investor_label
  FROM public.investors AS i
  WHERE i.user_id = NEW.investor_user_id
  LIMIT 1;

  investor_label := coalesce(nullif(trim(investor_label), ''), 'An investor');
  asset := CASE
    WHEN NEW.side IN ('sell_btc', 'buy_btc') THEN 'BTC'
    ELSE 'USDT'
  END;
  amount_label := public._format_p2p_asset_amount(asset, NEW.amount_requested);
  action_label := CASE
    WHEN NEW.side IN ('sell_usdt', 'sell_btc') THEN 'wants to buy'
    WHEN NEW.side IN ('buy_usdt', 'buy_btc') THEN 'wants to sell'
    ELSE 'opened a trade for'
  END;

  IF NEW.fiat_amount IS NOT NULL
     AND NEW.fiat_amount > 0
     AND coalesce(trim(NEW.fiat_currency_code), '') <> '' THEN
    fiat_label := format(
      ' Fiat snapshot: %s %s.',
      public._format_money_display(NEW.fiat_amount),
      upper(trim(NEW.fiat_currency_code))
    );
  END IF;

  INSERT INTO public.notifications (
    user_id,
    investor_email,
    title,
    message,
    type,
    is_read
  )
  VALUES (
    NEW.merchant_user_id,
    coalesce(merchant_email, ''),
    'New P2P trade',
    format(
      '%s %s %s on your P2P offer. Open the trade workspace to coordinate payment and settlement.%s',
      investor_label,
      action_label,
      amount_label,
      fiat_label
    ),
    'p2p_trade_new',
    false
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._format_p2p_asset_amount(text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tp_notify_p2p_merchant_order_inserted() FROM PUBLIC;

DROP TRIGGER IF EXISTS tp_notify_p2p_merchant_order_insert ON public.merchant_orders;
CREATE TRIGGER tp_notify_p2p_merchant_order_insert
AFTER INSERT ON public.merchant_orders
FOR EACH ROW
EXECUTE FUNCTION public.tp_notify_p2p_merchant_order_inserted();
