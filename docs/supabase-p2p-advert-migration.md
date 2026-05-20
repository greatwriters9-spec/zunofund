# P2P “advert message” migration (merchant offers)

If merchants see:

> Could not find the function `public.merchant_create_offer(... p_advert_message ...)` in the schema cache  

or investor search breaks when `advert_message` is expected in the RPC response, **the hosted Supabase project has not applied** migration:

[`supabase/migrations/20260623120000_merchant_offers_advert_message.sql`](../supabase/migrations/20260623120000_merchant_offers_advert_message.sql)

## What this migration adds

1. **`merchant_offers.advert_message`** (`text`, optional).
2. **Replaces** `merchant_create_offer` with a **7-parameter** overload (includes `p_advert_message`).
3. **Updates** `investor_search_merchant_offers` so results include **`advert_message`**.

## How to fix (recommended)

Follow your repo’s Supabase workflow (often `supabase db push` or Dashboard SQL Editor). Remote-only checklist:

[`docs/supabase-db-push-remote-only-migrations.md`](./supabase-db-push-remote-only-migrations.md)

After it runs, **restart or wait for PostgREST schema cache reload** if errors persist (~1–2 minutes on hosted).

## App behaviour until you migrate

- **Publish listing** retries with the **legacy 6-arg** RPC when the 7-arg function is missing, so offers **can still be created**.
- Merchant dashboard loads offers with **`select *`** so a missing **`advert_message`** column does not blank the whole list.

After migration, adverts save fully and investor cards can show them.
