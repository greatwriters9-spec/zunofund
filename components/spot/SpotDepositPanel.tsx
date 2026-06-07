"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Lock, QrCode } from "lucide-react";
import QRCode from "react-qr-code";

import { CryptoPicker } from "@/components/market-pickers/CryptoPicker";
import {
  CRYPTO_ASSET_CATALOG,
  findCryptoLabel,
  type CryptoAssetItem,
} from "@/components/market-pickers/cryptoCatalog";
import { DEPOSIT_EXCHANGE_ASSETS } from "@/lib/depositExchangeAssets";
import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import { useAuthUser } from "@/hooks/useAuthUser";
import { usePlatformDepositNetworks } from "@/hooks/usePlatformDepositNetworks";
import { loginHref, signupHref } from "@/lib/authLinks";
import { SPOT_NETWORK_WARNING, spotDepositPath } from "@/lib/spotDeposit";

type SpotDepositPanelProps = {
  initialAsset?: string;
  initialNetworkId?: string;
  compact?: boolean;
};

function findCatalogAsset(code: string): CryptoAssetItem | undefined {
  return CRYPTO_ASSET_CATALOG.find((item) => item.code === code.toUpperCase());
}

export function SpotDepositPanel({
  initialAsset = "USDT",
  initialNetworkId,
  compact = false,
}: SpotDepositPanelProps) {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuthUser();
  const { networks, loading: networksLoading, error: networksError } = usePlatformDepositNetworks();

  const [asset, setAsset] = useState(initialAsset.toUpperCase());
  const [networkId, setNetworkId] = useState(initialNetworkId ?? "");
  const [copied, setCopied] = useState(false);

  const catalogAsset = findCatalogAsset(asset);
  const depositNetworks = useMemo(
    () => networks.filter((network) => network.asset.toUpperCase() === asset.toUpperCase()),
    [asset, networks],
  );

  const selectedNetwork =
    depositNetworks.find((network) => network.id === networkId) ?? depositNetworks[0] ?? null;

  const depositNextPath = spotDepositPath(asset, selectedNetwork?.id);
  const loginUrl = loginHref(depositNextPath);
  const signupUrl = signupHref(depositNextPath);

  useEffect(() => {
    if (depositNetworks.length === 0) {
      setNetworkId("");
      return;
    }

    if (!depositNetworks.some((network) => network.id === networkId)) {
      setNetworkId(depositNetworks[0]!.id);
    }
  }, [depositNetworks, networkId]);

  function requireAuth(action: () => void) {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push(loginUrl);
      return;
    }
    action();
  }

  async function copyAddress() {
    if (!selectedNetwork?.wallet_address) return;
    await navigator.clipboard.writeText(selectedNetwork.wallet_address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const maskedAddress = "••••••••••••••••••••••••••••••••••";

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
        <CryptoPicker
          value={asset}
          onChange={(code) => {
            if (code && code !== "ALL") setAsset(code.toUpperCase());
          }}
          context="landing"
          variant="landing"
          fieldLabel="Asset"
          allowAllCrypto={false}
          assetList={DEPOSIT_EXCHANGE_ASSETS}
          forceSelectable
          sheetOverlayClassName="lg:hidden"
        />
      </div>

      {catalogAsset ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-4 py-3">
          <CryptoIcon asset={catalogAsset} size="lg" />
          <div>
            <p className="text-sm font-semibold text-white">{catalogAsset.name}</p>
            <p className="text-xs text-zinc-400">{catalogAsset.symbol}</p>
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Network
        </label>
        <select
          value={selectedNetwork?.id ?? ""}
          onChange={(event) => setNetworkId(event.target.value)}
          disabled={networksLoading || depositNetworks.length === 0}
          className="h-12 w-full rounded-xl border border-white/[0.1] bg-black/35 px-4 text-sm font-semibold text-[#F5E6B3] outline-none focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20"
        >
          {depositNetworks.length === 0 ? (
            <option value="">No network available</option>
          ) : (
            depositNetworks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.network_label || network.network_name}
              </option>
            ))
          )}
        </select>
      </div>

      {networksError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Could not load deposit wallets: {networksError}
        </p>
      ) : null}

      {depositNetworks.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-white">
            {findCryptoLabel(asset, "landing")} deposit not configured
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            No on-chain wallet is set for this asset yet. Select another coin or check back later.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Deposit address
              </p>
              {!isAuthenticated && !authLoading ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
                  <Lock className="h-3 w-3" aria-hidden />
                  Sign in required
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 break-all rounded-xl border border-white/[0.06] bg-[#05080F] px-3 py-3 font-mono text-xs text-white sm:text-sm">
                {isAuthenticated ? selectedNetwork?.wallet_address : maskedAddress}
              </p>
              <button
                type="button"
                onClick={() => requireAuth(() => void copyAddress())}
                disabled={!selectedNetwork?.wallet_address}
                className="inline-flex h-12 min-w-[7.5rem] items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 text-sm font-bold text-black transition hover:bg-[#E5BD45] disabled:opacity-50"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </button>
            </div>

            {copied ? (
              <p className="mt-2 text-xs font-medium text-emerald-400">Address copied successfully.</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Deposit QR code
            </div>

            {isAuthenticated && selectedNetwork?.wallet_address ? (
              <div className="mx-auto inline-flex rounded-2xl bg-white p-3">
                <QRCode
                  value={selectedNetwork.wallet_address}
                  size={compact ? 148 : 176}
                  bgColor="#FFFFFF"
                  fgColor="#05080F"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push(loginUrl)}
                className="mx-auto flex h-[11rem] w-[11rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D4AF37]/35 bg-[#D4AF37]/[0.05] px-4 text-center"
              >
                <Lock className="h-6 w-6 text-[#D4AF37]" aria-hidden />
                <span className="text-xs font-semibold text-[#F5E6B3]">Sign in to view QR code</span>
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
            <h3 className="text-sm font-semibold text-white">Deposit instructions</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-zinc-400">
              <li>Select your asset and the correct network.</li>
              <li>Copy the deposit address or scan the QR code.</li>
              <li>Send only {catalogAsset?.symbol ?? asset} on the selected network.</li>
              <li>Wait for network confirmations to credit your Zuno wallet.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-red-300">Network warning</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-300">{SPOT_NETWORK_WARNING}</p>
              </div>
            </div>
          </div>

          {!isAuthenticated && !authLoading ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href={loginUrl}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white transition hover:border-[#D4AF37]/40"
              >
                Log In
              </Link>
              <Link
                href={signupUrl}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#D4AF37] text-sm font-bold text-black transition hover:bg-[#E5BD45]"
              >
                Register
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
