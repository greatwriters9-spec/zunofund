DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT a.user_id INTO admin_uid
  FROM public.admins a
  ORDER BY a.user_id
  LIMIT 1;

  IF admin_uid IS NULL THEN
    RAISE EXCEPTION 'no admin in public.admins';
  END IF;

  UPDATE public.platform_contact_settings SET updated_by = NULL;

  DELETE FROM public.merchant_order_messages;
  DELETE FROM public.withdrawals;
  DELETE FROM public.merchant_orders;
  DELETE FROM public.merchant_offers;
  DELETE FROM public.merchant_profiles;
  DELETE FROM public.principal_locks;
  DELETE FROM public.deposits;
  DELETE FROM public.profits;
  DELETE FROM public.notifications;
  DELETE FROM public.ticket_replies;
  DELETE FROM public.support_tickets;
  DELETE FROM public.admin_notifications;
  DELETE FROM public.investors;

  DELETE FROM public.exchange_rates;

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

  DELETE FROM auth.refresh_tokens;
  DELETE FROM auth.mfa_amr_claims;
  DELETE FROM auth.sessions;
  DELETE FROM auth.one_time_tokens;
  DELETE FROM auth.mfa_factors;
  DELETE FROM auth.flow_state;
  DELETE FROM auth.identities WHERE user_id IS DISTINCT FROM admin_uid;
  DELETE FROM auth.users WHERE id IS DISTINCT FROM admin_uid;
END $$;
