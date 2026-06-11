import { normalizeAccountStatus } from "@/lib/accountStatus/labels";
import type { AccountStatusSnapshot } from "@/lib/accountStatus/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function parseIsoTimestamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

type InvestorStatusRow = {
  account_status?: string | null;
  status?: string | null;
  status_reason?: string | null;
  status_updated_at?: string | null;
  balance?: number | null;
  withdrawable_balance?: number | null;
  withdrawal_eligible_at?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export function buildAccountSnapshotFromInvestorRow(
  row: InvestorStatusRow | null | undefined,
): AccountStatusSnapshot | null {
  if (!row) return null;

  const status = normalizeAccountStatus(row.account_status ?? row.status);
  const balance = Number(row.balance ?? 0);
  const withdrawableBalance =
    status === "banned" ? balance : Number(row.withdrawable_balance ?? 0);

  return {
    account_status: status,
    status_reason: row.status_reason ?? null,
    status_updated_at: parseIsoTimestamp(row.status_updated_at),
    balance,
    withdrawable_balance: withdrawableBalance,
    withdrawal_eligible_at: parseIsoTimestamp(row.withdrawal_eligible_at),
    full_name: row.full_name ?? "",
    email: row.email ?? "",
  };
}

type InvestorStatusRpcPayload = {
  error?: string;
  account_status?: string | null;
  status_reason?: string | null;
  status_updated_at?: string | null;
  balance?: number | null;
  withdrawable_balance?: number | null;
  withdrawal_eligible_at?: string | null;
  full_name?: string | null;
  email?: string | null;
};

function buildAccountSnapshotFromRpc(
  payload: InvestorStatusRpcPayload | null | undefined,
): AccountStatusSnapshot | null {
  if (!payload || payload.error) return null;
  return buildAccountSnapshotFromInvestorRow({
    account_status: payload.account_status,
    status_reason: payload.status_reason,
    status_updated_at: payload.status_updated_at,
    balance: payload.balance,
    withdrawable_balance: payload.withdrawable_balance,
    withdrawal_eligible_at: payload.withdrawal_eligible_at,
    full_name: payload.full_name,
    email: payload.email,
  });
}

/** Load live account status; RPC fallback ensures withdrawal_eligible_at is always read. */
export async function fetchInvestorAccountSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountStatusSnapshot | null> {
  const { data, error } = await supabase
    .from("investors")
    .select(
      "account_status, status, status_reason, status_updated_at, balance, withdrawable_balance, withdrawal_eligible_at, full_name, email",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data) {
    return buildAccountSnapshotFromInvestorRow(data as InvestorStatusRow);
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("investor_get_account_status");
  if (rpcError) return null;
  return buildAccountSnapshotFromRpc(rpcData as InvestorStatusRpcPayload);
}
