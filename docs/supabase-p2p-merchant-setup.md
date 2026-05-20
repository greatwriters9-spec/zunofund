# Supabase setup for P2P merchants (admin provisioning)

Your Next.js app talks to **whatever project** `NEXT_PUBLIC_SUPABASE_URL` points at. The SQL that defines tables and RPCs lives in `supabase/migrations/` and **must be applied** to that project, or you will see errors such as:

> Could not find the function `public.admin_register_merchant_candidate` … in the schema cache

That means PostgREST does not see that function yet — almost always **migrations not applied** (or applied to a different project).

See also **[Supabase migrations alignment](supabase-migrations-alignment.md)** (CLI vs remote history, `project_id`, npm TLS).

## Apply migrations (recommended)

From the repo root, with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
supabase db push
```

Or run migrations through your usual CI/CD.

## Apply manually (SQL Editor)

In **Supabase Dashboard → SQL Editor**, run these files **in timestamp order** (once per project):

1. [`20260601120000_merchant_p2p.sql`](../supabase/migrations/20260601120000_merchant_p2p.sql) — core tables, RLS, main merchant RPCs  
2. [`20260619130000_is_merchant_alias.sql`](../supabase/migrations/20260619130000_is_merchant_alias.sql) — `is_merchant()` helper  
3. [`20260619130100_merchant_profiles_insert_pending_only.sql`](../supabase/migrations/20260619130100_merchant_profiles_insert_pending_only.sql) — tighten merchant profile INSERT policy  
4. [**`20260619200000_admin_only_merchant_registration.sql`**](../supabase/migrations/20260619200000_admin_only_merchant_registration.sql) — **`admin_register_merchant_candidate`** (needed for **Save merchant** in admin UI)  
5. [`20260620100000_merchant_admin_profile_rpc.sql`](../supabase/migrations/20260620100000_merchant_admin_profile_rpc.sql) — `admin_list_merchant_profiles`, `admin_revoke_merchant_access`, `merchant_update_display_name`
6. [`20260621100000_p2p_sell_investor_instructions_merchant_paid.sql`](../supabase/migrations/20260621100000_p2p_sell_investor_instructions_merchant_paid.sql) — withdraw/sell flow: investor payout instructions; `merchant_mark_buy_order_paid`; `investor_release_merchant_buy_order`
7. [`20260624120000_merchant_order_trade_chat.sql`](../supabase/migrations/20260624120000_merchant_order_trade_chat.sql) — **`merchant_order_messages`** + RLS + Realtime: persisted trade chat between investor and merchant on `/p2p/order/[id]`

After running SQL, wait a few seconds (or refresh the API); PostgREST reloads the schema cache.

## Server env

- **`SUPABASE_SERVICE_ROLE_KEY`** — still required for server routes that bypass RLS (e.g. cron, some admin APIs). Merchant provisioning **does not** create new Auth users; it only links an existing investor by email.

Legacy / unused:

- **`MERCHANT_DEFAULT_PASSWORD`** — previously used when provisioning created Auth users; that path is removed. You may omit this variable.

## Quick verification (SQL)

After migrations:

```sql
select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'admin_register_merchant_candidate';
```

You should see one row with arguments `p_user_id uuid, p_display_name text`.
