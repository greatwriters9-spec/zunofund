CREATE OR REPLACE FUNCTION public.admin_reset_platform_data(p_preserve_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  admin_uid uuid;
  admin_email text;
  deleted_users integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_preserve_email IS NOT NULL AND trim(p_preserve_email) <> '' THEN
    SELECT a.user_id, lower(trim(u.email))
    INTO admin_uid, admin_email
    FROM public.admins a
    JOIN auth.users u ON u.id = a.user_id
    WHERE lower(trim(u.email)) = lower(trim(p_preserve_email));
  ELSE
    SELECT a.user_id, lower(trim(u.email))
    INTO admin_uid, admin_email
    FROM public.admins a
    JOIN auth.users u ON u.id = a.user_id
    ORDER BY a.user_id
    LIMIT 1;
  END IF;

  IF admin_uid IS NULL THEN
    RAISE EXCEPTION 'no admin user found to preserve';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = admin_uid) THEN
    RAISE EXCEPTION 'preserved user is not in admins table';
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

  GET DIAGNOSTICS deleted_users = ROW_COUNT;

  RETURN jsonb_build_object(
    'preserved_admin_user_id', admin_uid,
    'preserved_admin_email', admin_email,
    'deleted_auth_users', deleted_users
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_platform_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_platform_data(text) TO service_role;
