/**
 * Applies one SQL migration file via Supabase Management API.
 * Usage: node scripts/apply-single-migration.mjs 20260531140000_wallet_lock_p2p_sell_full_balance.sql
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-single-migration.mjs <migration-filename.sql>");
  process.exit(1);
}

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "twqqnxrdnqszbjrdtjnl";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const query = readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8");
console.log(`Applying ${file} (${query.length} chars)...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log("OK", text.slice(0, 200));
