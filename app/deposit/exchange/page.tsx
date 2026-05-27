"use client";

import { useEffect, useMemo, useState } from "react";
import {
  displayPlanName,
  formatDepositRangeDescription,
  normalizeInvestmentPlan,
  validateMinimumDeposit,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import { formatUsdAmount } from "@/lib/formatMoney";
import {
  DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  depositAssetLabel,
  normalizePlatformDepositNetworkRows,
  type DepositAssetCode,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import { normalizeReferralCodeInput } from "@/lib/referrals";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";

export default function DepositExchangePage() {
  const supabase = useSupabase();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DepositAssetCode>("USDT");
  const [txid, setTxid] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [depositNetworks, setDepositNetworks] = useState<PlatformDepositNetwork[]>(
    DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  );
  const [networkId, setNetworkId] = useState(DEFAULT_PLATFORM_DEPOSIT_NETWORKS[0]!.id);
  const [networksLoading, setNetworksLoading] = useState(true);
  const [networksError, setNetworksError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [planSlug, setPlanSlug] =
    useState<CanonicalInvestmentPlan>("Starter");
  const [qualifyingPrincipal, setQualifyingPrincipal] = useState<number | null>(
    null,
  );
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return normalizeReferralCodeInput(new URL(window.location.href).searchParams.get("ref"));
  });
  const [hasReferralAttribution, setHasReferralAttribution] = useState(false);

  const activeDepositNetworks = useMemo(
    () => depositNetworks.filter((network) => network.is_active),
    [depositNetworks],
  );
  const paymentOptions = useMemo(
    () => Array.from(new Set(activeDepositNetworks.map((network) => network.asset))),
    [activeDepositNetworks],
  );
  const networkOptions = useMemo(
    () =>
      activeDepositNetworks.filter((network) => network.asset === paymentMethod),
    [activeDepositNetworks, paymentMethod],
  );
  const selectedDepositNetwork =
    networkOptions.find((network) => network.id === networkId) ??
    networkOptions[0] ??
    null;
  const walletAddress = selectedDepositNetwork?.wallet_address ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadDepositNetworks() {
      const { data, error } = await supabase
        .from("platform_deposit_networks")
        .select("id, asset, network_name, network_label, wallet_address, sort_order, is_active, updated_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (error) {
        setNetworksError(formatSupabaseError(error));
        setDepositNetworks(DEFAULT_PLATFORM_DEPOSIT_NETWORKS);
      } else {
        setNetworksError(null);
        const normalized = normalizePlatformDepositNetworkRows(data);
        setDepositNetworks(
          normalized.length > 0 ? normalized : DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
        );
      }
      setNetworksLoading(false);
    }

    void loadDepositNetworks();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (paymentOptions.length > 0 && !paymentOptions.includes(paymentMethod)) {
      setPaymentMethod(paymentOptions[0]!);
      return;
    }

    if (networkOptions.length > 0 && !selectedDepositNetwork) {
      setNetworkId(networkOptions[0]!.id);
    }
  }, [networkOptions, paymentMethod, paymentOptions, selectedDepositNetwork]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        if (!cancelled) {
          setPlanSlug("Starter");
          setQualifyingPrincipal(null);
          setPlanLoadError(null);
        }
        return;
      }
      const { data, error } = await supabase
        .from("investors")
        .select("investment_plan, tier_qualifying_principal, referred_by_user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPlanLoadError(formatSupabaseError(error));
        return;
      }
      setPlanLoadError(null);
      setPlanSlug(normalizeInvestmentPlan(data?.investment_plan));
      setHasReferralAttribution(Boolean((data as { referred_by_user_id?: unknown } | null)?.referred_by_user_id));
      const tqp = (data as { tier_qualifying_principal?: unknown })
        ?.tier_qualifying_principal;
      setQualifyingPrincipal(
        tqp !== null && tqp !== undefined && Number.isFinite(Number(tqp))
          ? Number(tqp)
          : null,
      );
    }
    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function copyWallet() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2500);
  }

  async function handleDeposit() {
    setFormError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("Please sign in to submit a deposit request.");
      setLoading(false);
      return;
    }

    const numAmount = Number(amount);
    const planMsg = validateMinimumDeposit(numAmount);
    if (planMsg) {
      setFormError(planMsg);
      setLoading(false);
      return;
    }

    if (!selectedDepositNetwork) {
      setFormError("Please select a valid deposit network.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("deposits").insert([
      {
        user_id: user.id,
        investor_email: user.email,
        amount: numAmount,
        txid,
        payment_method: selectedDepositNetwork.asset,
        deposit_network: selectedDepositNetwork.network_name,
        deposit_wallet_address: selectedDepositNetwork.wallet_address,
        referral_code:
          !hasReferralAttribution && referralCode.trim()
            ? normalizeReferralCodeInput(referralCode)
            : null,
        status: "pending",
      },
    ]);

    if (error) {
      setFormError(formatSupabaseError(error));
      setLoading(false);
      return;
    }

    setSubmitted(true);

    setAmount("");
    setTxid("");
    if (!hasReferralAttribution) setReferralCode("");
    setLoading(false);
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-zinc-900/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-10 text-center">

          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-yellow-500">✓</span>
          </div>

          <h1 className="text-4xl font-bold text-yellow-500 mb-4">
            Request Received
          </h1>

          <p className="text-zinc-400 text-lg leading-relaxed">
            Your investment request has been received successfully and will be processed within 30 minutes.
          </p>

          <button
            type="button"
            onClick={() => (window.location.href = "/dashboard")}
            className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-2xl transition-all"
          >
            Return to Dashboard
          </button>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-zinc-900/70 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8">

        <p className="text-zinc-500 text-sm mb-4">
          <a href="/deposit" className="text-yellow-500 hover:underline">
            ← Deposit options
          </a>
        </p>

        <h1 className="text-4xl font-bold text-yellow-500 mb-2">
          Deposit from exchange
        </h1>

        <p className="text-zinc-500 mb-6">
          Submit your investment deposit request (blockchain / exchange transfer).
        </p>

        {formError ? (
          <div
            className="mb-6 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        {planLoadError ? (
          <div
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="status"
          >
            Could not load your plan: {planLoadError}
          </div>
        ) : null}

        {networksError ? (
          <div
            className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="status"
          >
            Could not load admin deposit wallets, using defaults: {networksError}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
          <p className="text-yellow-400 font-semibold">
            Current tier: {displayPlanName(planSlug)}
          </p>

          <p className="text-sm text-zinc-400 mt-1">
            Tier follows{" "}
            <strong className="text-zinc-300">approved principal only</strong>
            {qualifyingPrincipal !== null ? (
              <>
                {" "}
                (currently about {formatUsdAmount(qualifyingPrincipal)}{" "}
                qualifying principal: locked deposits plus matured principal not
                yet withdrawn).
              </>
            ) : (
              " (qualifying principal updates after deposits are approved)."
            )}{" "}
            Profits do not upgrade your tier. You may deposit any amount above
            the platform minimum; there is no upper cap per tier.
          </p>

          <p className="text-xs text-zinc-500 mt-2">
            Brackets: Starter {formatDepositRangeDescription("Starter")}, Growth{" "}
            {formatDepositRangeDescription("Growth")}, Pro{" "}
            {formatDepositRangeDescription("Pro")}, Elite{" "}
            {formatDepositRangeDescription("Elite")}. Withdrawing principal can
            lower your tier when qualifying principal drops below a bracket.
          </p>
        </div>

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value as DepositAssetCode);
              setNetworkId("");
            }}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
            disabled={networksLoading || paymentOptions.length === 0}
          >
            {paymentOptions.map((asset) => (
              <option key={asset} value={asset}>
                {depositAssetLabel(asset)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Selected Network
          </label>

          <select
            value={selectedDepositNetwork?.id ?? ""}
            onChange={(e) => setNetworkId(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-yellow-500 font-semibold outline-none focus:border-yellow-500"
            disabled={networksLoading || networkOptions.length === 0}
          >
            {networkOptions.length === 0 ? (
              <option value="">No network available</option>
            ) : (
              networkOptions.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.network_name}
                  {network.network_label && network.network_label !== network.network_name
                    ? ` - ${network.network_label}`
                    : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Wallet Address
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={walletAddress}
              readOnly
              placeholder="Select a deposit network"
              className="flex-1 min-w-0 bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none text-white text-sm sm:text-base font-mono break-all"
            />

            <button
              type="button"
              onClick={copyWallet}
              disabled={!walletAddress}
              className="inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-yellow-500 px-6 font-bold text-black transition hover:bg-yellow-400 sm:w-auto sm:min-w-[120px]"
              aria-label="Copy wallet address"
            >
              Copy
            </button>
          </div>
        </div>
        {copied && (
          <p className="text-green-400 text-sm mt-2">
            Wallet address copied successfully.
          </p>
        )}

        <div className="mb-4">
          <label className="block mb-3 text-zinc-400">
            Deposit Amount
          </label>

          <input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
          />
        </div>

        {!hasReferralAttribution ? (
          <div className="mb-4">
            <label className="block mb-3 text-zinc-400">
              Referral Code <span className="text-zinc-600">(optional)</span>
            </label>

            <input
              type="text"
              placeholder="Enter referral code if you have one"
              value={referralCode}
              onChange={(e) => setReferralCode(normalizeReferralCodeInput(e.target.value))}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 font-mono uppercase tracking-wide outline-none focus:border-yellow-500"
            />
            <p className="mt-2 text-xs text-zinc-500">
              If you signed up through a referral link, this is already applied.
            </p>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Referral already applied to your account.
          </div>
        )}

        <div className="mb-6">
          <label className="block mb-3 text-zinc-400">
            Transaction Hash (TXID)
          </label>

          <input
            type="text"
            placeholder="Enter blockchain transaction hash"
            value={txid}
            onChange={(e) => setTxid(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500"
          />
        </div>

        <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/40 p-4">
          <h3 className="text-xl font-semibold text-white mb-4">
            Deposit Instructions
          </h3>

          <ol className="space-y-3 text-zinc-400 text-sm leading-relaxed list-decimal pl-5">
            <li>Open your crypto wallet or exchange.</li>

            <li>Copy the wallet address above.</li>

            <li>Send the exact amount you wish to deposit.</li>

            <li>Paste your transaction hash (TXID).</li>

            <li>Submit your deposit request.</li>
          </ol>
        </div>

        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
          <h3 className="text-red-400 font-semibold mb-2">
            Important Notice
          </h3>

          <p className="text-zinc-300 text-sm leading-relaxed">
            Always copy and paste the wallet address correctly before making payment.
            Sending funds to the wrong address or incorrect network may result in permanent loss of funds.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDeposit}
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all"
        >
          {loading ? "Submitting..." : "I HAVE MADE PAYMENT"}
        </button>

      </div>
    </main>
  );
}
