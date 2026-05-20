"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MerchantTradesNav } from "@/components/merchant/MerchantTradesNav";
import { MerchantTradesList } from "@/components/merchant/MerchantTradesList";
import type { MerchantOrderCard } from "@/components/merchant/merchantOrderTypes";
import { fetchMerchantOrdersWithInvestors } from "@/components/merchant/useMerchantOrders";
import { useSupabase } from "@/lib/supabase";

export default function MerchantCompletedTradesPage() {
  const supabase = useSupabase();
  const [orders, setOrders] = useState<MerchantOrderCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { orders: rows, error: msg } = await fetchMerchantOrdersWithInvestors(
      supabase,
      user.id,
      "completed",
    );
    setOrders(rows);
    setError(msg);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-yellow-500">Completed trades</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Settled or cancelled trades. Same layout as active trades for quick scanning of investor, open
              date, and amount.
            </p>
          </div>
          <Link
            href="/merchant"
            className="rounded-xl border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Merchant home
          </Link>
        </div>

        <div className="mt-8">
          <MerchantTradesNav />
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-8 text-zinc-500">Loading…</p>
        ) : (
          <div className="mt-6">
            <MerchantTradesList
              orders={orders}
              emptyMessage="No completed or cancelled trades yet."
            />
          </div>
        )}
      </div>
    </main>
  );
}
