"use client";

import { useEffect, useState } from "react";

import {
  depositAssetLabel,
  normalizePlatformDepositNetworkRows,
  type DepositAssetCode,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import {
  DEPOSIT_NETWORK_PRESETS,
  ZUNO_SUPPORTED_CRYPTO_CODES,
} from "@/lib/supportedCrypto";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

type DraftNetwork = Pick<
  PlatformDepositNetwork,
  "id" | "asset" | "network_name" | "network_label" | "wallet_address" | "is_active"
>;

function blankNetwork(asset: DepositAssetCode = "USDT"): DraftNetwork {
  const preset = DEPOSIT_NETWORK_PRESETS[asset][0];
  return {
    id: `new-${Date.now()}`,
    asset,
    network_name: preset?.network_name ?? "",
    network_label: preset?.network_label ?? "",
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

  function addPresetNetworks(asset: DepositAssetCode) {
    const presets = DEPOSIT_NETWORK_PRESETS[asset];
    setItems((current) => [
      ...current,
      ...presets.map((preset, index) => ({
        id: `new-${Date.now()}-${index}`,
        asset,
        network_name: preset.network_name,
        network_label: preset.network_label,
        wallet_address: "",
        is_active: true,
      })),
    ]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const incomplete = items.filter(
      (item) =>
        Boolean(item.network_name.trim()) !== Boolean(item.wallet_address.trim()),
    );
    if (incomplete.length > 0) {
      setBusy(false);
      setError(
        "Each wallet row needs both a network and a wallet address. Remove empty rows or finish filling them in.",
      );
      return;
    }

    const validItems = items.filter(
      (item) => item.network_name.trim() && item.wallet_address.trim(),
    );
    if (validItems.length === 0) {
      setBusy(false);
      setError("Add at least one wallet with a network and address before saving.");
      return;
    }

    const duplicateKey = new Set<string>();
    for (const item of validItems) {
      const key = `${item.asset}:${item.network_name.trim().toLowerCase()}`;
      if (duplicateKey.has(key)) {
        setBusy(false);
        setError(
          `Duplicate network for ${depositAssetLabel(item.asset)} (${item.network_name}). Each asset/network pair can only appear once.`,
        );
        return;
      }
      duplicateKey.add(key);
    }

    const payload = validItems.map((item, index) => ({
      asset: item.asset,
      network_name: item.network_name.trim(),
      network_label: item.network_label.trim(),
      wallet_address: item.wallet_address.trim(),
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
    if (saved.length < payload.length) {
      const savedKeys = new Set(
        saved.map((row) => `${row.asset}:${row.network_name.toLowerCase()}`),
      );
      const missing = payload.filter(
        (row) => !savedKeys.has(`${row.asset}:${row.network_name.toLowerCase()}`),
      );
      const missingSummary = missing
        .map((row) => `${row.asset} (${row.network_name})`)
        .join(", ");
      setError(
        `Only ${saved.length} of ${payload.length} wallets were saved. Could not save: ${missingSummary}. Each asset/network pair must be unique.`,
      );
      onSaved?.(saved);
      setItems(saved.map(toDraft));
      return;
    }

    onSaved?.(saved);
    setItems(saved.map(toDraft));
    setMessage(
      `Wallet addresses saved. ${saved.filter((item) => item.is_active).length} active network(s) will show on deposit pages.`,
    );
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {ZUNO_SUPPORTED_CRYPTO_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => addPresetNetworks(code)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-yellow-500/50 hover:text-yellow-200"
          >
            + {code} networks
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const presets = DEPOSIT_NETWORK_PRESETS[item.asset] ?? [];

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-zinc-800 bg-black/35 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {depositAssetLabel(item.asset)} · {item.network_name || "Network"}
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
                    onChange={(e) => {
                      const asset = e.target.value as DepositAssetCode;
                      const preset = DEPOSIT_NETWORK_PRESETS[asset][0];
                      updateItem(index, {
                        asset,
                        network_name: preset?.network_name ?? "",
                        network_label: preset?.network_label ?? "",
                      });
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                  >
                    {ZUNO_SUPPORTED_CRYPTO_CODES.map((code) => (
                      <option key={code} value={code}>
                        {depositAssetLabel(code)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Network
                  </span>
                  {presets.length > 0 ? (
                    <select
                      value={item.network_name}
                      onChange={(e) => {
                        const preset = presets.find((p) => p.network_name === e.target.value);
                        updateItem(index, {
                          network_name: e.target.value,
                          network_label: preset?.network_label ?? item.network_label,
                        });
                      }}
                      required
                      className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                    >
                      <option value="" disabled>
                        Select network
                      </option>
                      {presets.map((preset) => (
                        <option key={preset.network_name} value={preset.network_name}>
                          {preset.network_label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={item.network_name}
                      onChange={(e) =>
                        updateItem(index, { network_name: e.target.value })
                      }
                      required
                      className="w-full rounded-xl border border-zinc-700 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
                      placeholder="Network name"
                    />
                  )}
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
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setItems((current) => [...current, blankNetwork()])}
          className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-yellow-500/50"
        >
          Add wallet
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save wallet addresses"}
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
