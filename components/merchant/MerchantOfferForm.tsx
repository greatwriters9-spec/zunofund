"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { P2pMarketTab } from "@/components/p2p/p2pTypes";
import { parseMerchantOfferSide, sideLabel } from "@/components/merchant/merchantOfferSide";
import {
  DEFAULT_FIAT_CURRENCY,
  FIAT_CURRENCIES,
  type FiatCurrencyCode,
} from "@/lib/currencies";
import type { P2pAssetCode } from "@/lib/p2pAssets";
import { merchantOfferSide } from "@/lib/p2pAssets";
import { P2P_PAYMENT_METHOD_OPTIONS } from "@/lib/p2pPaymentMethods";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

export type MerchantOfferFormInitial = {
  offerId: string;
  side: string;
  payment_methods: string[];
  min_limit: number;
  max_limit: number;
  rate_percentage: number;
  payment_instructions: string | null;
  advert_message: string | null;
  fiat_currency_code: string | null;
};

type MerchantOfferFormProps = {
  mode: "create" | "edit";
  initial?: MerchantOfferFormInitial;
};

export function MerchantOfferForm({ mode, initial }: MerchantOfferFormProps) {
  const supabase = useSupabase();
  const parsed = initial ? parseMerchantOfferSide(initial.side) : null;

  const [listingAsset, setListingAsset] = useState<P2pAssetCode>(parsed?.asset ?? "USDT");
  const [listingTab, setListingTab] = useState<P2pMarketTab>(parsed?.tab ?? "sell");
  const side = mode === "edit" && initial ? initial.side : merchantOfferSide(listingTab, listingAsset);

  const [methods, setMethods] = useState<string[]>(
    initial?.payment_methods?.length ? [...initial.payment_methods] : ["mpesa"],
  );
  const [minL, setMinL] = useState(String(initial?.min_limit ?? 100));
  const [maxL, setMaxL] = useState(String(initial?.max_limit ?? 50000));
  const [rate, setRate] = useState(String(initial?.rate_percentage ?? 5));
  const [instructions, setInstructions] = useState(initial?.payment_instructions ?? "");
  const [advertMessage, setAdvertMessage] = useState(initial?.advert_message ?? "");
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrencyCode>(
    (initial?.fiat_currency_code?.toUpperCase() as FiatCurrencyCode) || DEFAULT_FIAT_CURRENCY,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEdit = mode === "edit";
  const listingTabFromSide = parsed?.tab ?? listingTab;

  useEffect(() => {
    if (isEdit) return;
    const q = new URLSearchParams(window.location.search).get("side");
    if (q === "buy_usdt" || q === "sell_usdt") {
      setListingAsset("USDT");
      setListingTab(q.startsWith("buy") ? "buy" : "sell");
    } else if (q === "buy_btc" || q === "sell_btc") {
      setListingAsset("BTC");
      setListingTab(q.startsWith("buy") ? "buy" : "sell");
    }
  }, [isEdit]);

  function toggleMethod(code: string) {
    setMethods((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const advertTrim = advertMessage.trim() ? advertMessage.trim().slice(0, 500) : null;
    const sellSide = isEdit ? listingTabFromSide === "sell" : listingTab === "sell";

    if (isEdit && initial) {
      const res = await supabase.rpc("merchant_update_offer", {
        p_offer_id: initial.offerId,
        p_payment_methods: methods.length ? methods : ["other"],
        p_min_limit: Number(minL),
        p_max_limit: Number(maxL),
        p_rate_percentage: Number(rate),
        p_payment_instructions: sellSide ? instructions.trim() || null : null,
        p_advert_message: advertTrim,
        p_fiat_currency_code: fiatCurrency,
      });
      setBusy(false);
      if (res.error) {
        setError(formatSupabaseError(res.error));
        return;
      }
      window.location.href = "/merchant?updated=1";
      return;
    }

    const res = await supabase.rpc("merchant_create_offer", {
      p_side: side,
      p_payment_methods: methods.length ? methods : ["other"],
      p_min_limit: Number(minL),
      p_max_limit: Number(maxL),
      p_rate_percentage: Number(rate),
      p_payment_instructions: listingTab === "sell" ? instructions.trim() || null : null,
      p_advert_message: advertTrim,
      p_fiat_currency_code: fiatCurrency,
    });

    setBusy(false);

    if (res.error) {
      setError(formatSupabaseError(res.error));
      return;
    }

    const qs = new URLSearchParams({ created: String(res.data ?? "") });
    window.location.href = `/merchant?${qs.toString()}`;
  }

  const inp =
    "w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-2 focus:ring-[#D4AF37]/22";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

  return (
    <>
      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <p className="mb-8 text-xs text-zinc-500 lg:hidden">
        <Link href="/merchant" className="font-semibold text-[#D4AF37] hover:text-[#F5E6B3]">
          ← Merchant console
        </Link>
      </p>

      <div className="max-w-4xl rounded-2xl border border-[#D4AF37]/18 bg-black/35 p-5 backdrop-blur-sm sm:p-6">
        <form onSubmit={submit} className="space-y-6">
          {isEdit && initial ? (
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className={label}>Listing type (locked)</p>
              <p className="mt-1 text-sm font-bold text-[#F5E6B3]">{sideLabel(initial.side)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Asset and buy/sell direction cannot change after publish. Create a new listing to switch.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className={label}>Asset</p>
                <div className="mt-2 flex gap-2">
                  {(["USDT", "BTC"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setListingAsset(a)}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-bold ${
                        listingAsset === a
                          ? "border-[#D4AF37]/50 bg-[#D4AF37]/12 text-[#F5E6B3]"
                          : "border-white/10 text-zinc-400"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={label}>Listing side</p>
                <div
                  className="mt-2 flex flex-row gap-2 rounded-xl border border-white/10 bg-black/30 p-1"
                  role="tablist"
                  aria-label="Offer direction"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listingTab === "sell"}
                    onClick={() => setListingTab("sell")}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-bold uppercase leading-snug tracking-wide sm:text-xs sm:leading-tight md:py-3 ${
                      listingTab === "sell"
                        ? "bg-red-600/90 text-white ring-1 ring-red-400/40"
                        : "text-zinc-400 hover:text-[#F5E6B3]"
                    }`}
                  >
                    Sell {listingAsset}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listingTab === "buy"}
                    onClick={() => setListingTab("buy")}
                    className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-bold uppercase leading-snug tracking-wide sm:text-xs sm:leading-tight md:py-3 ${
                      listingTab === "buy"
                        ? "bg-emerald-700 text-white ring-1 ring-emerald-400/40"
                        : "text-zinc-400 hover:text-[#F5E6B3]"
                    }`}
                  >
                    Buy {listingAsset}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <p className={label}>Settlement rails · tap chips</p>
            <div className="mt-3 flex flex-row flex-wrap gap-2">
              {P2P_PAYMENT_METHOD_OPTIONS.map((o) => {
                const on = methods.includes(o.code);
                return (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => toggleMethod(o.code)}
                    className={`rounded-lg border px-3 py-1.5 text-left text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/45 ${
                      on
                        ? "border-emerald-500/45 bg-emerald-600/18 text-emerald-100 ring-1 ring-emerald-500/30"
                        : "border-white/12 bg-black/25 text-zinc-400 hover:border-[#D4AF37]/30 hover:text-zinc-200"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className={label}>Fiat settlement currency</p>
            <select
              value={fiatCurrency}
              onChange={(e) => setFiatCurrency(e.target.value as FiatCurrencyCode)}
              className={`mt-2 ${inp} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23D4AF37%22><path d=%22M5 8l5 5 5-5z%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
            >
              {FIAT_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0c1018] text-white">
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="min-w-0 sm:col-span-1">
              <span className={label}>Min ({fiatCurrency})</span>
              <input type="number" value={minL} onChange={(e) => setMinL(e.target.value)} className={`mt-2 ${inp}`} />
            </label>
            <label className="min-w-0 sm:col-span-1">
              <span className={label}>Max ({fiatCurrency})</span>
              <input type="number" value={maxL} onChange={(e) => setMaxL(e.target.value)} className={`mt-2 ${inp}`} />
            </label>
            <label className="min-w-0 sm:col-span-2">
              <span className={label}>
                {(isEdit ? listingTabFromSide : listingTab) === "sell" ? "Buyer fee %" : "Fee % / margin"}
              </span>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className={`mt-2 ${inp}`} />
            </label>
          </div>

          <label className="block">
            <span className={label}>Advert (marketplace ribbon)</span>
            <textarea
              value={advertMessage}
              onChange={(e) => setAdvertMessage(e.target.value.slice(0, 500))}
              rows={2}
              maxLength={500}
              placeholder="Short headline investors see beside your ribbon…"
              className={`mt-2 ${inp} resize-y text-[13px] leading-snug`}
            />
            <span className="mt-1 block text-right text-[10px] text-zinc-600">{advertMessage.length}/500</span>
          </label>

          {(isEdit ? listingTabFromSide : listingTab) === "sell" ? (
            <label className="block">
              <span className={label}>Fiat payout instructions</span>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="Accounts, Till numbers, etc."
                className={`${inp} resize-y`}
              />
            </label>
          ) : (
            <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-[11px] text-zinc-500">
              <span className="font-semibold text-zinc-400">Buy listings:</span> investors paste payout details in each
              trade ticket.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/22 transition hover:bg-emerald-500 disabled:opacity-45"
          >
            {busy ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish offer"}
          </button>
        </form>
      </div>
    </>
  );
}
