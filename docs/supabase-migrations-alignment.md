# Supabase migrations — how local files, the CLI, and production line up

## What “aligned” means

- **`supabase/migrations/*.sql`** in this repo is the source of truth for **what** the database should look like.
- **`supabase_migrations.schema_migrations`** on the hosted project records **which** migration versions have been applied (by filename prefix, e.g. `20260621120000`).
- The **Supabase CLI** (`supabase db push`, `supabase migration list`) compares those two. If a version in `migrations/` is missing from `schema_migrations`, the CLI tries to run that file.

## Why there were two “histories” for the same P2P work

Some changes were applied to production using the Supabase MCP / Dashboard path, which registered **several** small migrations (e.g. `p2p_sell_defer_investor_deduction`, `p2p_release_investor_release_rpc`, …) with **auto-generated version timestamps**.

The repo groups the same SQL into **four** files:

| Local file (version prefix) | Purpose |
|----------------------------|---------|
| `20260621120000_p2p_sell_defer_investor_deduction.sql` | Defer sell escrow, restore, create sell order, first release RPC |
| `20260621140000_p2p_release_records_withdrawal.sql` | Withdrawals row + triggers + release + history RPC |
| `20260621160000_p2p_buy_offer_no_merchant_details_shared_withdrawal.sql` | Buy-offer rules, `apply_withdrawal_fifo_deduction`, approve withdrawal, final release RPC |
| `20260621200000_p2p_investor_approves_withdrawal_core.sql` | Investor P2P release: `approve_withdrawal_core` pending→approved + same withdrawal-approved email trigger as admins |

So the **database already had the objects** from the chunked migrations; the only gap was **recording** the repo’s version numbers on the remote so `db push` would not try to run them again.

That was fixed by inserting rows into `supabase_migrations.schema_migrations` for:

- `20260621120000`
- `20260621140000`
- `20260621160000`
- `20260621200000`

(Statements are empty placeholders for those repair-style rows; the real DDL was applied earlier. This is the same idea as `supabase migration repair --status applied <version>`.)

## Investor financial trigger + RPC withdrawals (`20260622100000`)

Scopes `investors_prevent_financial_self_edit` so non-admins updating **their own** row via the API cannot tamper with balances while **SECURITY DEFINER** flows can debit/credit ledger rows safely (investor JWT + optional txn-local bypass in `apply_withdrawal_fifo_deduction`). Apply with a normal `supabase db push` when onboarding a new env.

## P2P approval always FIFO (`20260622131000`)

**`approve_withdrawal_core`** applies **`apply_withdrawal_fifo_deduction`** on every P2P approval (investor release), not only when `defer_investor_deduction_until_release` — fixes missing balance decreases when `defer` was false/mismatched locally vs prod.

## Using the CLI on your machine

1. **Install / run CLI**  
   - `npx supabase@latest …` or install globally.  
   - If npm fails TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`), try:  
     `set NODE_OPTIONS=--use-system-ca` (Windows) before `npx`.

2. **Log in** (once):  
   `npx supabase login`

3. **Link this repo to the project** (writes credentials under `supabase/`; do not commit secrets):  
   `npx supabase link --project-ref twqqnxrdnqszbjrdtjnl`  
   You will need the **database password** from Supabase Dashboard → Project Settings → Database.

4. **Check status**:  
   `npx supabase migration list`  
   When you’re aligned with the hosted **`twqqnxrdnqszbjrdtjnl`** project, **Local** and **Remote** match on every migration row (repair details: [supabase-db-push-remote-only-migrations.md](supabase-db-push-remote-only-migrations.md#-hosted-project-twqqnxrdnqszbjrdtjnl-aligned)).

5. **Deploy new migrations** (after adding a new file under `supabase/migrations/`):  
   `npx supabase db push`

If **`db push`** fails with **“Remote migration versions not found in local migrations directory”**, the hosted project logged Dashboard/MCP migration timestamps that do not exist as files in this repo. See **[Fix remote-only migration ledger](supabase-db-push-remote-only-migrations.md)** (`docs/supabase-db-push-remote-only-migrations.md`).

## New environments (another Supabase project or fresh local DB)

- Apply migrations in **timestamp order** (or use `supabase db push` against that project).
- You do **not** need the “alignment” inserts on a database that never had the chunked MCP migrations—those inserts only matter when the same schema was applied under different migration version names.

## Env hint

`.env.example` includes optional `SUPABASE_PROJECT_REF` for scripts and docs; it matches the ref in `config.toml` and in `NEXT_PUBLIC_SUPABASE_URL`.
