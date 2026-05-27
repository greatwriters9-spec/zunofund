"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Scale } from "lucide-react";

import { formatFiat } from "@/lib/currencies";
import { assetFromOfferSide, fmtAssetAmount } from "@/lib/p2pAssets";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type DisputeRow = {
  order_id: string;
  side: string;
  status: string;
  amount_requested: number;
  fiat_currency_code: string | null;
  fiat_amount: number | null;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  investor_label: string;
  merchant_label: string;
};

export default function AdminP2pDisputesPage() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("admin_list_p2p_disputes");
    setLoading(false);
    if (e) {
      setError(formatSupabaseError(e));
      setRows([]);
      return;
    }
    setRows((data as DisputeRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#F5E6B3]">
            <Scale className="h-7 w-7 text-[#D4AF37]" aria-hidden />
            P2P disputes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Open disputes after a trade is marked paid. Join the trade chat, review proof, then award
            escrow to the investor or merchant.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-[#D4AF37]/30 px-4 py-2 text-sm font-medium text-[#F5E6B3] transition hover:bg-black/40"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-zinc-500">Loading disputes…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[#D4AF37]/15 bg-black/30 px-6 py-12 text-center text-zinc-500">
          No open disputes.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#D4AF37]/15">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#D4AF37]/15 bg-black/40 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Parties</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const asset = assetFromOfferSide(r.side);
                const amt = fmtAssetAmount(asset, r.amount_requested);
                const fiat =
                  r.fiat_currency_code &&
                  r.fiat_currency_code !== "USD" &&
                  r.fiat_amount &&
                  r.fiat_amount > 0
                    ? formatFiat(Number(r.fiat_amount), r.fiat_currency_code)
                    : null;
                return (
                  <tr key={r.order_id} className="bg-black/20 hover:bg-black/35">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                      {r.dispute_opened_at
                        ? new Date(r.dispute_opened_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-zinc-300">#{r.order_id.slice(0, 8)}</p>
                      <p className="mt-0.5 text-zinc-500">
                        {amt}
                        {fiat ? ` · ${fiat}` : null}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <p>{r.investor_label}</p>
                      <p className="text-zinc-500">vs {r.merchant_label}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-zinc-400">
                      <p className="line-clamp-2">{r.dispute_reason ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/p2p-disputes/${r.order_id}`}
                        className="inline-flex rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                      >
                        Review & resolve
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
