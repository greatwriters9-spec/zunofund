"use client";

import { useEffect, useMemo, useState } from "react";
import {
  normalizeInvestmentPlan,
  validateMinimumDeposit,
  type CanonicalInvestmentPlan,
} from "@/lib/investmentPlans";
import {
  DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  normalizePlatformDepositNetworkRows,
  type PlatformDepositNetwork,
} from "@/lib/platformDepositNetworks";
import { normalizeReferralCodeInput } from "@/lib/referrals";
import { useSupabase, formatSupabaseError } from "@/lib/supabase";
import {
  DepositExchangeView,
  type DepositSubmissionDetails,
  type RecentDepositRow,
} from "@/components/deposit/DepositExchangeView";

export default function DepositExchangePage() {
  const supabase = useSupabase();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("USDT");
  const [txid] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState<DepositSubmissionDetails | null>(null);
  const [depositNetworks, setDepositNetworks] = useState<PlatformDepositNetwork[]>(
    DEFAULT_PLATFORM_DEPOSIT_NETWORKS,
  );
  const [networkId, setNetworkId] = useState("");
  const [networksLoading, setNetworksLoading] = useState(true);
  const [networksError, setNetworksError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [planSlug, setPlanSlug] = useState<CanonicalInvestmentPlan>("Starter");
  const [qualifyingPrincipal, setQualifyingPrincipal] = useState<number | null>(null);
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return normalizeReferralCodeInput(new URL(window.location.href).searchParams.get("ref"));
  });
  const [hasReferralAttribution, setHasReferralAttribution] = useState(false);
  const [recentDeposits, setRecentDeposits] = useState<RecentDepositRow[]>([]);
  const [recentDepositsLoading, setRecentDepositsLoading] = useState(true);

  const activeDepositNetworks = useMemo(
    () => depositNetworks.filter((network) => network.is_active),
    [depositNetworks],
  );
  const networkOptions = useMemo(
    () =>
      activeDepositNetworks.filter(
        (network) => network.asset.toUpperCase() === paymentMethod.toUpperCase(),
      ),
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
    if (networkOptions.length > 0 && !selectedDepositNetwork) {
      setNetworkId(networkOptions[0]!.id);
    }
  }, [networkOptions, selectedDepositNetwork]);

  useEffect(() => {
    if (networkOptions.length > 0 && !networkOptions.some((network) => network.id === networkId)) {
      setNetworkId(networkOptions[0]!.id);
    }
  }, [networkOptions, networkId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentDeposits() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        if (!cancelled) {
          setRecentDeposits([]);
          setRecentDepositsLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("deposits")
        .select("id, amount, payment_method, deposit_network, status, created_at, txid")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!cancelled) {
        setRecentDeposits((data as RecentDepositRow[] | null) ?? []);
        setRecentDepositsLoading(false);
      }
    }

    void loadRecentDeposits();
    return () => {
      cancelled = true;
    };
  }, [supabase, submitted]);

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
      const tqp = (data as { tier_qualifying_principal?: unknown })?.tier_qualifying_principal;
      setQualifyingPrincipal(
        tqp !== null && tqp !== undefined && Number.isFinite(Number(tqp)) ? Number(tqp) : null,
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

    setSubmittedDetails({
      coin: selectedDepositNetwork.asset,
      network: selectedDepositNetwork.network_name,
      amount: numAmount,
      submittedAt: new Date().toLocaleString(),
      status: "Deposit Pending Review",
    });
    setSubmitted(true);

    setAmount("");
    if (!hasReferralAttribution) setReferralCode("");
    setLoading(false);
  }

  function handlePaymentMethodChange(code: string) {
    setPaymentMethod(code);
    setNetworkId("");
  }

  return (
    <DepositExchangeView
      formError={formError}
      planLoadError={planLoadError}
      networksError={networksError}
      planSlug={planSlug}
      qualifyingPrincipal={qualifyingPrincipal}
      networksLoading={networksLoading}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={handlePaymentMethodChange}
      networkOptions={networkOptions}
      selectedDepositNetwork={selectedDepositNetwork}
      networkId={networkId}
      onNetworkIdChange={setNetworkId}
      walletAddress={walletAddress}
      copied={copied}
      onCopyWallet={() => void copyWallet()}
      amount={amount}
      onAmountChange={setAmount}
      referralCode={referralCode}
      onReferralCodeChange={(value) => setReferralCode(normalizeReferralCodeInput(value))}
      hasReferralAttribution={hasReferralAttribution}
      loading={loading}
      onSubmit={() => void handleDeposit()}
      submitted={submitted}
      submittedDetails={submittedDetails}
      onReturnDashboard={() => {
        window.location.href = "/dashboard";
      }}
      recentDeposits={recentDeposits}
      recentDepositsLoading={recentDepositsLoading}
    />
  );
}
