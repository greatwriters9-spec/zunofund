"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy, Info } from "lucide-react";
import QRCode from "react-qr-code";

import { DepositInlineCoinSelector } from "@/components/deposit/DepositInlineCoinSelector";
import { CryptoIcon } from "@/components/market-pickers/CryptoIcon";
import { displayPlanName, MIN_PLATFORM_DEPOSIT_USD, type CanonicalInvestmentPlan } from "@/lib/investmentPlans";
import { formatUsdAmount } from "@/lib/formatMoney";
import {
  DEPOSIT_EXCHANGE_ASSETS,
  findDepositExchangeAsset,
} from "@/lib/depositExchangeAssets";
import type { PlatformDepositNetwork } from "@/lib/platformDepositNetworks";

export type DepositSubmissionDetails = {
  coin: string;
  network: string;
  amount: number;
  submittedAt: string;
  status: string;
};

export type RecentDepositRow = {
  id: string;
  amount: number;
  payment_method: string;
  deposit_network: string | null;
  status: string;
  created_at: string;
  txid: string | null;
};

type DepositExchangeViewProps = {
  formError: string | null;
  planLoadError: string | null;
  networksError: string | null;
  planSlug: CanonicalInvestmentPlan;
  qualifyingPrincipal: number | null;
  networksLoading: boolean;
  paymentMethod: string;
  onPaymentMethodChange: (code: string) => void;
  networkOptions: PlatformDepositNetwork[];
  selectedDepositNetwork: PlatformDepositNetwork | null;
  networkId: string;
  onNetworkIdChange: (id: string) => void;
  walletAddress: string;
  copied: boolean;
  onCopyWallet: () => void;
  amount: string;
  onAmountChange: (value: string) => void;
  referralCode: string;
  onReferralCodeChange: (value: string) => void;
  hasReferralAttribution: boolean;
  loading: boolean;
  onSubmit: () => void;
  submitted: boolean;
  submittedDetails: DepositSubmissionDetails | null;
  onReturnDashboard: () => void;
  recentDeposits: RecentDepositRow[];
  recentDepositsLoading: boolean;
};

const QUICK_COINS = ["USDT", "USDC", "BNB", "BTC", "SOL"] as const;

const FAQ_ITEMS = [
  { label: "How to deposit crypto? (Guide)", href: "/deposit" },
  { label: "Deposit hasn't arrived?", href: "/contact" },
  { label: "Deposit & withdrawal status", href: "/dashboard" },
] as const;

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved" || s === "completed" || s === "resolved") return "text-emerald-400";
  if (s === "disputed") return "text-violet-400";
  if (s === "rejected" || s === "failed" || s === "reversed") return "text-red-400";
  return "text-amber-300";
}

function formatStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "Completed";
  if (s === "resolved") return "Dispute resolved";
  if (s === "disputed") return "Under dispute";
  if (s === "reversed") return "Reversed";
  if (s === "pending") return "Pending Review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function FlowStep({
  step,
  title,
  state,
  isLast,
  children,
}: {
  step: number;
  title: string;
  state: "complete" | "active" | "upcoming";
  isLast?: boolean;
  children?: ReactNode;
}) {
  const dot =
    state === "complete" ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D4AF37] text-black">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    ) : (
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
          state === "active"
            ? "border-[#D4AF37] text-[#D4AF37]"
            : "border-zinc-700 text-zinc-600"
        }`}
      >
        {step}
      </span>
    );

  return (
    <div className="flex gap-3">
      <div className="flex w-5 flex-col items-center">
        {dot}
        {!isLast ? (
          <span
            className={`mt-1 w-px flex-1 min-h-[1.25rem] ${
              state === "complete" ? "bg-[#D4AF37]/50" : "bg-zinc-800"
            }`}
            aria-hidden
          />
        ) : null}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? "pb-2" : "pb-7"}`}>
        <h2
          className={`text-sm font-medium ${
            state === "upcoming" ? "text-zinc-600" : "text-zinc-200"
          }`}
        >
          {title}
        </h2>
        {children && state !== "upcoming" ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

function FaqSidebar() {
  return (
    <aside className="w-[200px] shrink-0 pt-1">
      <h2 className="text-sm font-semibold text-zinc-300">FAQ</h2>
      <ul className="mt-3 space-y-2.5">
        {FAQ_ITEMS.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="text-xs leading-snug text-zinc-500 transition hover:text-[#D4AF37]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function DepositExchangeView({
  formError,
  planLoadError,
  networksError,
  planSlug,
  qualifyingPrincipal,
  networksLoading,
  paymentMethod,
  onPaymentMethodChange,
  networkOptions,
  selectedDepositNetwork,
  networkId,
  onNetworkIdChange,
  walletAddress,
  copied,
  onCopyWallet,
  amount,
  onAmountChange,
  referralCode,
  onReferralCodeChange,
  hasReferralAttribution,
  loading,
  onSubmit,
  submitted,
  submittedDetails,
  onReturnDashboard,
  recentDeposits,
  recentDepositsLoading,
}: DepositExchangeViewProps) {
  const [coinPickerOpen, setCoinPickerOpen] = useState(true);
  const selectedAsset = findDepositExchangeAsset(paymentMethod);
  const hasNetwork = Boolean(selectedDepositNetwork?.wallet_address);
  const coinConfirmed = !coinPickerOpen;

  function selectCoin(code: string) {
    onPaymentMethodChange(code.toUpperCase());
    setCoinPickerOpen(false);
  }

  if (submitted && submittedDetails) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-xl font-semibold text-white">Deposit Pending Review</h1>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-3">
            <dt className="text-zinc-500">Coin</dt>
            <dd className="font-medium text-white">{submittedDetails.coin}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-3">
            <dt className="text-zinc-500">Network</dt>
            <dd className="font-medium text-white">{submittedDetails.network}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-3">
            <dt className="text-zinc-500">Amount</dt>
            <dd className="font-medium text-[#D4AF37]">
              {submittedDetails.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-800/80 pb-3">
            <dt className="text-zinc-500">Submitted</dt>
            <dd className="text-zinc-300">{submittedDetails.submittedAt}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-amber-300">{submittedDetails.status}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onReturnDashboard}
          className="mt-8 w-full rounded-lg bg-[#D4AF37] py-3 text-sm font-bold text-black hover:bg-[#E5BD45]"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
      <Link
        href="/deposit"
        className="text-xs text-zinc-500 transition hover:text-[#D4AF37]"
      >
        ← Back
      </Link>

      <h1 className="mt-3 text-xl font-semibold text-white">Deposit Crypto</h1>
      <p className="mt-1 text-xs text-zinc-500">
        {displayPlanName(planSlug)} tier
        {qualifyingPrincipal !== null
          ? ` · ${formatUsdAmount(qualifyingPrincipal)} qualifying`
          : ""}{" "}
        · Min {formatUsdAmount(MIN_PLATFORM_DEPOSIT_USD)}
      </p>

      {formError ? (
        <p className="mt-4 text-xs text-red-400" role="alert">
          {formError}
        </p>
      ) : null}
      {planLoadError ? (
        <p className="mt-2 text-xs text-amber-300">Plan: {planLoadError}</p>
      ) : null}
      {networksError ? (
        <p className="mt-2 text-xs text-amber-300">Wallets: {networksError}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        <div className="w-full max-w-[480px]">
          <FlowStep
            step={1}
            title="Select Coin"
            state={coinConfirmed ? "complete" : "active"}
          >
            <DepositInlineCoinSelector
              value={paymentMethod}
              onChange={selectCoin}
              expanded={coinPickerOpen}
              onExpandedChange={setCoinPickerOpen}
              assets={DEPOSIT_EXCHANGE_ASSETS}
            />
            {coinPickerOpen ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {QUICK_COINS.map((code) => {
                  const asset = findDepositExchangeAsset(code);
                  const active = paymentMethod === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => selectCoin(code)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                        active
                          ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5E6B3]"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {asset ? <CryptoIcon asset={asset} /> : null}
                      {code}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </FlowStep>

          <FlowStep
            step={2}
            title="Select Network"
            state={
              !coinConfirmed
                ? "upcoming"
                : hasNetwork
                  ? "complete"
                  : "active"
            }
          >
            {!coinConfirmed ? null : networkOptions.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No deposit wallet configured for {selectedAsset?.symbol ?? paymentMethod} yet.
                Ask an admin to add one in Wallet management.
              </p>
            ) : (
              <>
                <select
                  value={networkId}
                  onChange={(e) => onNetworkIdChange(e.target.value)}
                  disabled={networksLoading}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-transparent px-3 text-sm text-zinc-200 outline-none focus:border-[#D4AF37]/40"
                >
                  {networkOptions.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.network_name}
                      {network.network_label && network.network_label !== network.network_name
                        ? ` · ${network.network_label}`
                        : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Only send funds using the selected network.
                </p>
              </>
            )}
          </FlowStep>

          <FlowStep
            step={3}
            title="Deposit Address"
            state={!coinConfirmed ? "upcoming" : hasNetwork ? "active" : "upcoming"}
          >
            {coinConfirmed && hasNetwork ? (
              <>
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      Send only {selectedAsset?.symbol ?? paymentMethod} on{" "}
                      {selectedDepositNetwork?.network_name}. Wrong network transfers may be lost.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 rounded-lg bg-white p-2">
                    <QRCode value={walletAddress} size={120} bgColor="#FFFFFF" fgColor="#05080F" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-zinc-500">Address</p>
                    <div className="mt-1 flex items-start gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-zinc-200">
                        {walletAddress}
                      </p>
                      <button
                        type="button"
                        onClick={onCopyWallet}
                        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-[#D4AF37]"
                        aria-label="Copy address"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {copied ? (
                      <p className="mt-1 text-[11px] text-emerald-400">Copied</p>
                    ) : null}
                    <p className="mt-3 text-[11px] text-zinc-500">
                      Minimum deposit: more than {formatUsdAmount(MIN_PLATFORM_DEPOSIT_USD)}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </FlowStep>

          <FlowStep
            step={4}
            title="Deposit Amount"
            state={!coinConfirmed || !hasNetwork ? "upcoming" : "active"}
          >
            {coinConfirmed && hasNetwork ? (
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Enter amount you are sending"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-transparent px-3 text-sm text-white outline-none focus:border-[#D4AF37]/40"
              />
            ) : null}
          </FlowStep>

          <FlowStep
            step={5}
            title="Mark As Sent"
            state={!coinConfirmed || !hasNetwork ? "upcoming" : "active"}
            isLast
          >
            {coinConfirmed && hasNetwork ? (
              <div className="space-y-3">
                {!hasReferralAttribution ? (
                  <input
                    type="text"
                    placeholder="Referral code (optional)"
                    value={referralCode}
                    onChange={(e) => onReferralCodeChange(e.target.value)}
                    className="h-9 w-full rounded-lg border border-zinc-800 bg-transparent px-3 font-mono text-xs uppercase text-zinc-300 outline-none focus:border-[#D4AF37]/40"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={loading}
                  className="h-10 w-full rounded-lg bg-[#D4AF37] text-sm font-bold text-black transition hover:bg-[#E5BD45] disabled:opacity-50"
                >
                  {loading ? "Submitting…" : "Mark As Sent"}
                </button>
              </div>
            ) : null}
          </FlowStep>

          <section className="mt-10 border-t border-zinc-800/80 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300">Recent Deposits</h2>
              <Link href="/dashboard" className="text-xs text-[#D4AF37] hover:text-[#E5BD45]">
                More
              </Link>
            </div>
            {recentDepositsLoading ? (
              <p className="text-xs text-zinc-600">Loading…</p>
            ) : recentDeposits.length === 0 ? (
              <p className="text-xs text-zinc-600">No recent deposits</p>
            ) : (
              <ul className="divide-y divide-zinc-800/80">
                {recentDeposits.map((deposit) => (
                  <li key={deposit.id} className="py-3 first:pt-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-zinc-200">
                        {deposit.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}{" "}
                        {deposit.payment_method}
                      </span>
                      <span
                        className={`text-xs font-medium ${statusBadgeClass(deposit.status)}`}
                      >
                        {formatStatusLabel(deposit.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {new Date(deposit.created_at).toLocaleDateString()}
                      {deposit.deposit_network ? ` · ${deposit.deposit_network}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="hidden lg:block">
          <FaqSidebar />
        </div>
      </div>

      <div className="mt-6 lg:hidden">
        <FaqSidebar />
      </div>
    </div>
  );
}
