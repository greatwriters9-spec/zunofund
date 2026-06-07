"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BadgeCheck, ChevronDown, SlidersHorizontal } from "lucide-react";

import { CryptoPicker } from "@/components/market-pickers/CryptoPicker";
import { MobileLandingSpotAssetList } from "@/components/landing/mobile/MobileLandingSpotAssetList";
import { MobileLandingStickyNav } from "@/components/landing/mobile/MobileLandingStickyNav";
import {
  MOBILE_MARKETPLACE_SECTION_ID,
  type MobileLandingTabId,
} from "@/components/landing/mobile/mobileLandingData";
import { PaymentMethodPicker } from "@/components/payment-methods/PaymentMethodPicker";
import type { OfferCardRow } from "@/components/p2p/OfferCard";
import { paymentMethodLabelCaps } from "@/components/p2p/utils";
import type { P2pAssetCode } from "@/components/p2p/p2pTypes";
import { signupHref } from "@/lib/authLinks";
import { FIAT_CURRENCIES, getFiatCurrency, type FiatCurrencyCode } from "@/lib/currencies";
import { assetFromOfferSide, formatLimitRange, resolveP2pOfferSide } from "@/lib/p2pAssets";
import { DEPOSIT_EXCHANGE_ASSETS } from "@/lib/depositExchangeAssets";
import { isP2pRpcTradeableAsset, p2pListingsUnavailableMessage } from "@/lib/supportedCrypto";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { formatOfferUnitPriceAmount, offerFiatPerOneCrypto } from "@/lib/p2pValue";
import { useFxRates } from "@/lib/useFx";

const COMPACT_PICKER_CLASS =
  "!h-[34px] !min-h-[34px] !w-full !min-w-0 !rounded-lg !border-white/[0.08] !bg-white/[0.03] !px-2 !py-2 !text-[9px] !font-medium !text-zinc-300";

const LANDING_OFFER_LIMIT = 4;

function MobileLandingFiatPicker({
  value,
  onChange,
}: {
  value: FiatCurrencyCode | "";
  onChange: (code: FiatCurrencyCode | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = value ? getFiatCurrency(value).code : "All Regions";

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        className="flex h-[34px] w-full items-center justify-between gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[9px] font-medium text-zinc-300"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[220] max-h-[min(280px,45dvh)] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#0c1018] py-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md"
        >
          <button
            type="button"
            className={`block w-full px-3 py-2 text-left text-[12px] hover:bg-white/[0.05] ${
              value === "" ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
            }`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            All Regions
          </button>
          {FIAT_CURRENCIES.map((currency) => (
            <button
              key={currency.code}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/[0.05] ${
                value === currency.code ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
              }`}
              onClick={() => {
                onChange(currency.code);
                setOpen(false);
              }}
            >
              <span aria-hidden>{currency.flag}</span>
              <span className="font-semibold">{currency.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PaymentBadge({ label }: { label: string }) {
  const short = label.length > 6 ? label.slice(0, 1) : label;
  const tone =
    label.includes("VISA") || label.includes("CARD")
      ? "bg-blue-600/80 text-white"
      : label.includes("BANK")
        ? "bg-zinc-600/80 text-white"
        : label.includes("M-PESA") || label.includes("MPESA")
          ? "bg-emerald-600/80 text-white"
          : "bg-[#D4AF37]/25 text-[#F5E6B3]";

  return (
    <span
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[7px] font-bold ${tone}`}
      title={label}
    >
      {short}
    </span>
  );
}

type MobileLandingP2PSectionProps = {
  activeTab: MobileLandingTabId;
  onTabChange: (tab: MobileLandingTabId) => void;
};

export function MobileLandingP2PSection({
  activeTab,
  onTabChange,
}: MobileLandingP2PSectionProps) {
  const supabase = useSupabase();
  const { rates: fxRates } = useFxRates();
  const listId = useId();
  const isP2P = activeTab === "p2p";
  const isSpot = activeTab === "spot";
  const [asset, setAsset] = useState<P2pAssetCode>("USDT");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrencyCode | "">("");
  const [offers, setOffers] = useState<OfferCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const side = resolveP2pOfferSide("buy", asset);
    if (!side) {
      setLoading(false);
      setOffers([]);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("investor_search_merchant_offers", {
      p_side: side,
      p_amount: null,
      p_payment_method: null,
      p_fiat_currency_code: null,
      p_amount_currency: null,
    });

    setLoading(false);

    if (rpcErr) {
      setError(formatSupabaseError(rpcErr));
      setOffers([]);
      return;
    }

    setOffers((data as OfferCardRow[]) ?? []);
  }, [asset, supabase]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const isDefaultBrowse =
    asset === "USDT" && paymentMethod.trim() === "" && fiatCurrency === "";

  const filteredOffers = useMemo(() => {
    let list = offers;

    if (paymentMethod.trim()) {
      const method = paymentMethod.trim();
      list = list.filter((row) => row.payment_methods?.includes(method));
    }

    if (fiatCurrency) {
      list = list.filter(
        (row) => (row.fiat_currency_code || "USD").toUpperCase() === fiatCurrency,
      );
    }

    return list;
  }, [fiatCurrency, offers, paymentMethod]);

  const visibleOffers = useMemo(
    () =>
      isDefaultBrowse ? filteredOffers.slice(0, LANDING_OFFER_LIMIT) : filteredOffers,
    [filteredOffers, isDefaultBrowse],
  );

  return (
    <section
      id={MOBILE_MARKETPLACE_SECTION_ID}
      className="scroll-mt-[3.25rem] border-t border-[#D4AF37]/10 pt-5"
    >
      <div className="px-3">
        <h2 className="text-center text-lg font-bold leading-tight text-white">
          {isSpot ? (
            <>
              Spot <span className="text-[#D4AF37]">Deposit Center</span>
            </>
          ) : (
            <>
              Buy and Sell Crypto <span className="text-[#D4AF37]">via Zuno</span>
            </>
          )}
        </h2>

        <div className="mt-4">
          <MobileLandingStickyNav
            activeTab={activeTab}
            onTabChange={onTabChange}
            variant="segment"
          />
        </div>

        <p className="text-center text-[11px] text-zinc-500">
          {isSpot
            ? "Select an asset to deposit on-chain"
            : "Buy or sell crypto with 350+ payment options"}
        </p>

        {isSpot ? <MobileLandingSpotAssetList /> : null}

        {isP2P ? (
        <div className="mt-3 flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <CryptoPicker
              value={asset}
              onChange={(code) => {
                if (code) setAsset(code as P2pAssetCode);
              }}
              context="portal"
              variant="toolbar"
              assetList={DEPOSIT_EXCHANGE_ASSETS}
              forceSelectable
              displayLabel={asset}
              sheetOverlayClassName="lg:hidden"
              className={COMPACT_PICKER_CLASS}
            />
          </div>

          <div className="min-w-0 flex-[1.35]">
            <PaymentMethodPicker
              value={paymentMethod}
              onChange={setPaymentMethod}
              allowAllMethods
              variant="toolbar"
              sheetOverlayClassName="lg:hidden"
              className={COMPACT_PICKER_CLASS}
            />
          </div>

          <MobileLandingFiatPicker value={fiatCurrency} onChange={setFiatCurrency} />

          <Link
            href="/p2p/buy"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400"
            aria-label="Open full P2P marketplace"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        ) : null}

        {isP2P ? (
        <>
        <div className="mt-3 grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.75fr)] gap-x-1.5 border-b border-white/[0.06] pb-2 text-[8px] font-semibold uppercase tracking-wide text-zinc-500">
          <span>Merchant</span>
          <span>Payment</span>
          <span>Price</span>
          <span className="text-right">Limit</span>
        </div>

        <div
          id={listId}
          className={`divide-y divide-white/[0.05] ${
            isDefaultBrowse
              ? ""
              : "max-h-[min(65dvh,560px)] overflow-y-auto overscroll-y-contain [scrollbar-width:thin]"
          }`}
        >
          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-500">Loading offers…</p>
          ) : error ? (
            <p className="py-8 text-center text-xs text-red-400">{error}</p>
          ) : visibleOffers.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">
              {!isP2pRpcTradeableAsset(asset)
                ? p2pListingsUnavailableMessage(asset)
                : "No offers match your filters. Try another payment method or region."}
            </p>
          ) : (
            visibleOffers.map((row) => {
              const name = row.merchant_display_name || "Merchant";
              const offerAsset = assetFromOfferSide(row.side);
              const fiatCode = (row.fiat_currency_code || "USD").toUpperCase();
              const fiatPerCrypto = offerFiatPerOneCrypto(
                offerAsset,
                fiatCode,
                Number(row.rate_percentage) || 0,
                row.side,
                fxRates,
              );
              const priceMain = formatOfferUnitPriceAmount(fiatPerCrypto, fiatCode);
              const limits = formatLimitRange(
                Number(row.min_limit),
                Number(row.max_limit),
                fiatCode,
                offerAsset,
                offerAsset,
                fxRates,
              );
              const payments = row.payment_methods
                .map((code) => paymentMethodLabelCaps(code))
                .filter(Boolean)
                .slice(0, 3);

              return (
                <div
                  key={row.offer_id}
                  className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.75fr)] items-start gap-x-1.5 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[9px] font-bold text-[#D4AF37]">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-0.5">
                          <p className="truncate text-[11px] font-semibold text-white">{name}</p>
                          <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
                        </div>
                        <p className="text-[9px] text-zinc-500">{fiatCode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-0.5 pt-1">
                    {payments.length > 0 ? (
                      payments.map((payment) => <PaymentBadge key={payment} label={payment} />)
                    ) : (
                      <span className="text-[9px] text-zinc-500">—</span>
                    )}
                  </div>

                  <div className="pt-0.5">
                    <p className="text-[11px] font-bold tabular-nums text-emerald-400">
                      {priceMain} {fiatCode}
                    </p>
                    <p className="text-[9px] tabular-nums text-zinc-500">/{offerAsset.toLowerCase()}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 pt-0.5">
                    <p className="text-right text-[8px] leading-snug text-zinc-400">{limits}</p>
                    <Link
                      href={signupHref("/p2p/buy")}
                      className="rounded-md bg-[#D4AF37] px-2.5 py-1 text-[9px] font-bold text-black"
                    >
                      Buy
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        ) : null}
      </div>
    </section>
  );
}
