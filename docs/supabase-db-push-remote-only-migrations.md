# Fix: “Remote migration versions not found in local migrations directory”

## ✅ Hosted project `twqqnxrdnqszbjrdtjnl` (aligned)

As of repo maintenance, **`supabase_migrations.schema_migrations`** on this project was repaired so **`npx supabase migration list`** shows **Local | Remote** on the same row for **every file** under `supabase/migrations/`. Orphan Dashboard/MCP version rows were removed; missing repo timestamps were inserted as ledger placeholders; **`20260622100000`**, **`20260622131000`**, and **`20260622140000`** were applied (DDL) and recorded under those exact version strings.

Going forward you can rely on **`npx supabase db push`** for new migration files unless history drifts again.

---

`npx supabase db push` compares:

- filenames under `supabase/migrations/` (local), and  
- rows in **`supabase_migrations.schema_migrations`** on the linked project (remote).

If **remote has version numbers that are not local files** — common when SQL was applied via Supabase Dashboard, MCP, or auto-generated timestamps — the CLI **refuses to push**.

Your project’s **`npx supabase migration list`** shows many rows like:

| Local | Remote        |
|-------|---------------|
| (empty) | `20260516060321` |

Those **Remote-only** timestamps must be cleared from the history table (CLI calls this **repaired as reverted**), **or** you add matching empty migration files for every orphan (usually worse).

---

## Step 1 — Mark remote-only orphans as **reverted** (one shot)

Run from repo root (**PowerShell**) after `npx supabase link` succeeds:

```powershell
$npx = "npx"
$orphans = @(
  '20260516060321','20260516060411','20260516060520','20260516060841','20260516062321',
  '20260516064113','20260516073106','20260516075347','20260516075748','20260516080436',
  '20260516081721','20260516085512','20260516085631','20260517225145','20260517225835',
  '20260517230602','20260518024016','20260518141805','20260518153530','20260518154755',
  '20260518155707','20260518155928','20260518160113','20260518160251','20260518184323',
  '20260518184333','20260519225516','20260519225529','20260519225532','20260519230719',
  '20260519230728','20260519230729','20260519230732','20260520005512','20260520014510',
  '20260520014531','20260520014547','20260520014607','20260520014625','20260520014636',
  '20260520014658','20260520014712','20260520014727','20260520014749','20260520021529',
  '20260520021549'
)
& $npx supabase migration repair --status reverted --linked @orphans
```

If the CLI prompts for confirmation, review and accept.

Then recheck:

```powershell
npx supabase migration list
```

The “Remote only” column for those versions should be gone.

---

## Step 2 — Why `db push` may **still** be unsafe

After Step 1, **remote** may only list a few applied versions (for example the `2026062112…` / `2026062120…` P2P files), while **local** still has many older files (from `20250515…` onward) whose versions are **not** on remote.

In that case `db push` will try to run the **first missing** local migration (often `20250515100000`). That can **fail** with “already exists” if your database was built from Dashboard SQL instead of those exact files.

### Safer ways to ship **new** SQL

**A) Dashboard + mark applied (minimal risk for a few files)**  

1. Paste and run the contents of the new file(s) in **Supabase → SQL Editor**.  
2. Then only mark those versions as applied (no execution):

   ```powershell
   npx supabase migration repair --status applied --linked 20260622100000 20260622131000 20260622140000
   ```

   (Adjust version list to match what you actually ran.)

**B) Align full history (advanced)**  

If you are sure **production already matches** this repo’s migration chain, you can `migration repair --status applied --linked` for **every** local version that is missing on remote, **in timestamp order**, without running `db push`. Only do this when you understand the risk of lying to the migration ledger.

**C) Clean environment**  

For a new Supabase project or branch, run only `supabase/migrations/` from scratch so local and remote stay identical.

---

## Summary

- **`db push` does not delete offers**; it only applies migration files. Offer deletion is the `merchant_delete_offer` RPC + migration `20260622140000_*` (see merchant dashboard).  
- Fix the **error in your screenshot** by repairing **remote-only** versions (Step 1).  
- Deploy new changes with **A** or fully align history with **B** before relying on `db push` for old baselines.
