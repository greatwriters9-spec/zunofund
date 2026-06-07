"use client";

import { useCallback, useEffect, useState } from "react";

import { CurrencyPicker } from "@/components/currency/CurrencyPicker";
import type { P2pAssetCode } from "@/components/p2p/p2pTypes";
import { formatFiat, getFiatCurrency } from "@/lib/currencies";
import { DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatMoneyAmount } from "@/lib/formatMoney";
import { fromUsd } from "@/lib/exchangeRates";
import { fmtAssetAmount } from "@/lib/p2pAssets";
import { isP2pRpcTradeableAsset } from "@/lib/supportedCrypto";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { useDisplayCurrency, useFxRates } from "@/lib/useFx";

type P2pSellableBalanceProps = {
  defaultAsset?: P2pAssetCode;
  refreshKey?: number;
};

export function P2pSellableBalance({
  defaultAsset = "USDT",
  refreshKey = 0,
}: P2pSellableBalanceProps) {
  const supabase = useSupabase();
  const { rates: fxRates } = useFxRates();
  const tradeableDefault = isP2pRpcTradeableAsset(defaultAsset) ? defaultAsset : "USDT";
  const [displayCrypto, setDisplayCrypto] = useState<"USDT" | "BTC">(tradeableDefault);
  const [displayFiat, setDisplayFiat] = useDisplayCurrency();
  const [sellableUsd, setSellableUsd] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDisplayCrypto(isP2pRpcTradeableAsset(defaultAsset) ? defaultAsset : "USDT");
  }, [defaultAsset]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw, error } = await supabase.rpc("investor_p2p_sellable_balances");
      if (error) {
        console.error("[p2p] sellable balances:", formatSupabaseError(error));
        setSellableUsd(0);
        return;
      }
      const row = (raw ?? {}) as Record<string, unknown>;
      setSellableUsd(Number(row.sellable_usd) || 0);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const fiatMeta = getFiatCurrency(displayFiat);

  const coreAmount =
    displayCrypto === "BTC"
      ? fmtAssetAmount("BTC", fromUsd(sellableUsd, "BTC", fxRates))
      : formatMoneyAmount(sellableUsd);

  const fiatLine = formatFiat(fromUsd(sellableUsd, displayFiat, fxRates), displayFiat);

  function cycleCryptoUnit() {
    setDisplayCrypto((u) => (u === "USDT" ? "BTC" : "USDT"));
  }

  return (
    <div
      className="dashboard-balance-stable border-b border-white/[0.06] bg-[rgba(5,7,13,0.95)] px-4 pb-4 pt-3 sm:px-6"
      aria-label="Est. total value"
    >
      <p className="text-sm font-normal tracking-tight" style={{ color: DASHBOARD_MUTED }}>
        Est. Total Value (
        <button
          type="button"
          onClick={cycleCryptoUnit}
          className="font-medium text-[#D4AF37] underline-offset-2 transition hover:text-[#F5E6B3] hover:underline"
          aria-label={`Display unit ${displayCrypto}. Click to switch to ${displayCrypto === "USDT" ? "BTC" : "USDT"}.`}
        >
          {displayCrypto}
        </button>
        )
      </p>

      <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="min-w-0 text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-[1.75rem]">
          {loading ? "—" : coreAmount}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <p
            className="text-sm tabular-nums text-zinc-300/90"
            title={`${fiatMeta.name} · ${fiatMeta.code}`}
          >
            {loading ? "—" : fiatLine}
          </p>
          <CurrencyPicker
            value={displayFiat}
            onChange={setDisplayFiat}
            size="sm"
            triggerVariant="code-only"
            align="end"
          />
        </div>
      </div>
    </div>
  );
}
