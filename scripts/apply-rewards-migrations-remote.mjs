/**
 * Applies rewards SQL migration files via Supabase Management API.
 * Requires: SUPABASE_ACCESS_TOKEN (Personal Access Token from supabase.com/dashboard/account/tokens)
 * Optional: SUPABASE_PROJECT_REF (default twqqnxrdnqszbjrdtjnl)
 *
 * Usage: node scripts/apply-rewards-migrations-remote.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRef = process.env.SUPABASE_PROJECT_REF ?? "twqqnxrdnqszbjrdtjnl";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create a token at https://supabase.com/dashboard/account/tokens",
  );
  process.exit(1);
}

const files = [
  "20260529140000_rewards_loyalty_program.sql",
  "20260529150000_rewards_admin_activation_only.sql",
];

const root = join(process.cwd(), "supabase", "migrations");

for (const file of files) {
  const query = readFileSync(join(root, file), "utf8");
  const name = file.replace(/^\d+_/, "").replace(/\.sql$/, "");
  console.log(`Applying ${file} ...`);

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

  const body = await res.text();
  if (!res.ok) {
    console.error(`Failed ${file}:`, res.status, body);
    process.exit(1);
  }
  console.log(`OK ${file}`);
}

console.log("All rewards migrations applied.");
