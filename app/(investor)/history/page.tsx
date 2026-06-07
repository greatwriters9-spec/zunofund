"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  TransactionHistoryView,
  type HistoryFilter,
  type HistoryTransaction,
} from "@/components/history/TransactionHistoryView";
import { useSupabase } from "@/lib/supabase";

const HISTORY_FILTERS = [
  "all",
  "deposit",
  "withdrawal",
  "profit",
  "referral_bonus",
  "reward",
] as const;

function isHistoryFilter(value: string | null): value is HistoryFilter {
  return value != null && (HISTORY_FILTERS as readonly string[]).includes(value);
}

function HistoryPageContent() {
  const supabase = useSupabase();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<HistoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFilter, setActiveFilter] = useState<HistoryFilter>(() => {
    const q = searchParams.get("filter");
    return isHistoryFilter(q) ? q : "all";
  });

  useEffect(() => {
    const q = searchParams.get("filter");
    if (isHistoryFilter(q)) setActiveFilter(q);
  }, [searchParams]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setLoading(false);
      return;
    }

    const { data: rows, error } = await supabase.rpc("investor_recent_transactions", {
      p_limit: 250,
    });

    if (error) {
      console.error(error);
      setTransactions([]);
      setLoading(false);
      return;
    }

    type RpcTxn = {
      id: string;
      txn_type: string;
      amount: number;
      status: string;
      description: string | null;
      created_at: string;
    };

    const mergedTransactions = ((rows ?? []) as RpcTxn[]).reduce<HistoryTransaction[]>(
      (acc, item) => {
        const t = item.txn_type;
        if (
          t !== "deposit" &&
          t !== "withdrawal" &&
          t !== "profit" &&
          t !== "referral_bonus" &&
          t !== "reward"
        ) {
          return acc;
        }
        acc.push({
          id: item.id,
          type: t,
          amount: Number(item.amount),
          status: item.status || "completed",
          description: item.description ?? undefined,
          created_at: item.created_at,
        });
        return acc;
      },
      [],
    );

    setTransactions(mergedTransactions);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchHistory();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [fetchHistory]);

  return (
    <TransactionHistoryView
      transactions={transactions}
      loading={loading}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
    />
  );
}

function HistoryPageFallback() {
  return (
    <TransactionHistoryView
      transactions={[]}
      loading
      activeFilter="all"
      onFilterChange={() => {}}
    />
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryPageFallback />}>
      <HistoryPageContent />
    </Suspense>
  );
}
