/**
 * Smoke-test daily compound: eligibility report + run_daily_investment_jobs.
 * Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in env or .env.local.
 *
 * Usage: node scripts/test-daily-compound.mjs
 *        node scripts/test-daily-compound.mjs --prepare   # reset test investors for next accrual
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const prepare = process.argv.includes("--prepare");

if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  if (prepare) {
    const { data, error } = await supabase.rpc(
      "admin_prepare_investors_for_compound",
      {
        p_reset_last_compound: true,
        p_only_with_balance: true,
      },
    );
    if (error) {
      console.error("prepare failed:", error.message);
      process.exit(1);
    }
    console.log("Prepared investors:", data);
  }

  const { data: rows, error: repErr } = await supabase.rpc(
    "compound_eligibility_report",
  );
  if (repErr) {
    console.error("eligibility report failed:", repErr.message);
    console.error(
      "Apply migration 20260630200000_compound_cron_reliability.sql first.",
    );
    process.exit(1);
  }

  const list = rows ?? [];
  const eligible = list.filter((r) => r.eligibility === "eligible");
  const blocked = list.filter((r) => r.eligibility !== "eligible");

  console.log("\n--- Eligibility (non-admin investors) ---");
  console.log(`Eligible now: ${eligible.length}`);
  for (const r of eligible.slice(0, 20)) {
    console.log(
      `  ${r.email} | balance=${r.balance} | plan=${r.investment_plan} | last=${r.last_compound_at ?? "never"}`,
    );
  }
  if (eligible.length > 20) console.log(`  ... +${eligible.length - 20} more`);

  console.log(`\nBlocked: ${blocked.length}`);
  for (const r of blocked.slice(0, 15)) {
    console.log(`  ${r.email} | ${r.eligibility} | balance=${r.balance}`);
  }

  const { data: job, error: jobErr } = await supabase.rpc(
    "run_daily_investment_jobs",
  );
  if (jobErr) {
    console.error("\nrun_daily_investment_jobs failed:", jobErr.message);
    process.exit(1);
  }

  console.log("\n--- Job result ---");
  console.log(JSON.stringify(job, null, 2));

  const { data: after } = await supabase.rpc("compound_eligibility_report");
  const stillEligible = (after ?? []).filter((r) => r.eligibility === "eligible");
  console.log(`\nStill eligible immediately after run: ${stillEligible.length}`);
  if (stillEligible.length > 0) {
    console.log("(Expected 0 unless job did not credit — check migration applied.)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
