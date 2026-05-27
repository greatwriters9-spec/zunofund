"use client";

import { useEffect, useState } from "react";

import {
  depositAssetLabel,
  normalizePlatformDepositNetworkRows,
  type DepositAssetCode,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type DraftNetwork = Pick<
  PlatformDepositNetwork,
  "id" | "asset" | "network_name" | "network_label" | "wallet_address" | "is_active"
>;

function blankNetwork(): DraftNetwork {
  return {
    id: `new-${Date.now()}`,
    asset: "USDT",
    network_name: "",
    network_label: "",
    wallet_address: "",
    is_active: true,
  };
}

function toDraft(network: PlatformDepositNetwork): DraftNetwork {
  return {
    id: network.id,
    asset: network.asset,
    network_name: network.network_name,
    network_label: network.network_label,
    wallet_address: network.wallet_address,
    is_active: network.is_active,
  };
}

export function AdminDepositNetworksForm({
  initial,
  onSaved,
}: {
  initial: PlatformDepositNetwork[];
  onSaved?: (networks: PlatformDepositNetwork[]) => void;
}) {
  const supabase = useSupabase();
  const [items, setItems] = useState<DraftNetwork[]>(() => initial.map(toDraft));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial.map(toDraft));
  }, [initial]);

  function updateItem(index: number, patch: Partial<DraftNetwork>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function moveItem(index: number, delta: number) {
    setItems((current) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload = items.map((item, index) => ({
      asset: item.asset,
      network_name: item.network_name,
      network_label: item.network_label,
      wallet_address: item.wallet_address,
      is_active: item.is_active,
      sort_order: index,
    }));

    const { data, error: rpcError } = await supabase.rpc(
      "admin_replace_platform_deposit_networks",
      { p_items: payload },
    );

    setBusy(false);

    if (rpcError) {
      setError(formatSupabaseError(rpcError));
      return;
    }

    const saved = normalizePlatformDepositNetworkRows(data);
    onSaved?.(saved);
    setItems(saved.map(toDraft));
    setMessage(
      `Deposit networks saved. ${saved.filter((item) => item.is_active).length} active network(s) will show on the deposit page.`,
    );
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-2xl border border-zinc-800 bg-black/35 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Network {index + 1}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => current.filter((_, i) => i !== index))
                  }
                  className="rounded-lg border border-red-500/40 px-2 py-1 text-red-300"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Asset
                </span>
                <select
                  value={item.asset}
                  onChange={(e) =>
                    updateItem(index, {
                      asset: e.target.value as DepositAssetCode,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                >
                  <option value="USDT">{depositAssetLabel("USDT")}</option>
                  <option value="BTC">{depositAssetLabel("BTC")}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Network
                </span>
                <input
                  type="text"
                  value={item.network_name}
                  onChange={(e) =>
                    updateItem(index, { network_name: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                  placeholder="BSC"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Network label
                </span>
                <input
                  type="text"
                  value={item.network_label}
                  onChange={(e) =>
                    updateItem(index, { network_label: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                  placeholder="BNB Smart Chain (BEP20)"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Wallet address
                </span>
                <input
                  type="text"
                  value={item.wallet_address}
                  onChange={(e) =>
                    updateItem(index, { wallet_address: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                  placeholder="Wallet address"
                />
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={item.is_active}
                onChange={(e) =>
                  updateItem(index, { is_active: e.target.checked })
                }
                className="size-4 rounded border-zinc-600 bg-zinc-900 text-yellow-500 focus:ring-yellow-500/40"
              />
              Active on deposit page
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setItems((current) => [...current, blankNetwork()])}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-yellow-500/50"
        >
          Add network
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save deposit networks"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-400" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
