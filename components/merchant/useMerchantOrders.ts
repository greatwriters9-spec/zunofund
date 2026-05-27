"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MerchantOrderCard } from "./merchantOrderTypes";

export async function fetchMerchantOrdersWithInvestors(
  supabase: SupabaseClient,
  merchantUserId: string,
  statusFilter: "active" | "completed",
): Promise<{ orders: MerchantOrderCard[]; error: string | null }> {
  const activeStatuses = ["pending_payment", "paid", "disputed"];
  const completedStatuses = ["completed", "cancelled"];

  let q = supabase
    .from("merchant_orders")
    .select(
      `
      id,
      side,
      status,
      amount_requested,
      usdt_credit_amount,
      usdt_escrow_amount,
      fiat_currency_code,
      fiat_amount,
      investor_user_id,
      created_at,
      expires_at
    `,
    )
    .eq("merchant_user_id", merchantUserId)
    .order("created_at", { ascending: false });

  if (statusFilter === "active") {
    q = q.in("status", activeStatuses);
  } else {
    q = q.in("status", completedStatuses);
  }

  const { data: rows, error: qErr } = await q;

  if (qErr) {
    return { orders: [], error: qErr.message };
  }

  const ordersRaw = rows ?? [];
  const ids = [...new Set(ordersRaw.map((r) => r.investor_user_id).filter(Boolean))] as string[];

  let invMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (ids.length > 0) {
    const { data: profs, error: rpcErr } = await supabase.rpc("merchant_list_counterparty_profiles", {
      p_investor_user_ids: ids,
    });
    if (rpcErr) {
      return { orders: [], error: rpcErr.message };
    }
    invMap = new Map(
      (profs ?? []).map((row: { user_id: string; email: string | null; full_name: string | null }) => [
        row.user_id,
        { email: row.email ?? null, full_name: row.full_name ?? null },
      ]),
    );
  }

  const orders: MerchantOrderCard[] = ordersRaw.map((r) => ({
    id: r.id as string,
    side: r.side as string,
    status: r.status as string,
    amount_requested: Number(r.amount_requested),
    usdt_credit_amount: r.usdt_credit_amount != null ? Number(r.usdt_credit_amount) : null,
    usdt_escrow_amount: r.usdt_escrow_amount != null ? Number(r.usdt_escrow_amount) : null,
    fiat_currency_code: (r.fiat_currency_code as string | null) ?? null,
    fiat_amount: r.fiat_amount != null ? Number(r.fiat_amount) : null,
    created_at: r.created_at as string,
    expires_at: r.expires_at as string,
    investor:
      invMap.get(r.investor_user_id as string) ??
      ({ email: null, full_name: null } as MerchantOrderCard["investor"]),
  }));

  return { orders, error: null };
}
