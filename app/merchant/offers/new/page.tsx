"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MerchantAppShell } from "@/components/merchant/MerchantAppShell";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";
import { P2P_PAYMENT_METHOD_OPTIONS } from "@/lib/p2pPaymentMethods";

export default function MerchantNewOfferPage() {
  const supabase = useSupabase();
  const [side, setSide] = useState<"sell_usdt" | "buy_usdt">("sell_usdt");
  const [methods, setMethods] = useState<string[]>(["mpesa"]);
  const [minL, setMinL] = useState("100");
  const [maxL, setMaxL] = useState("50000");
  const [rate, setRate] = useState("5");
  const [instructions, setInstructions] = useState("");
  const [advertMessage, setAdvertMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("side");
    if (q === "buy_usdt" || q === "sell_usdt") {
      setSide(q);
    }
  }, []);

  function toggleMethod(code: string) {
    setMethods((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function merchantCreateOfferMissingAdvertMigration(err: unknown): boolean {
    const msg = typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : "";
    const code =
      typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
    /** Supabase REST when PostgREST has no overload with p_advert_message (migration not pushed). */
    return (
      code === "PGRST202" ||
      msg.includes("schema cache") ||
      msg.includes("Could not find the function") ||
      (msg.includes("merchant_create_offer") && msg.includes("p_advert_message"))
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const baseArgs = {
      p_side: side,
      p_payment_methods: methods.length ? methods : ["other"],
      p_min_limit: Number(minL),
      p_max_limit: Number(maxL),
      p_rate_percentage: Number(rate),
      p_payment_instructions: side === "sell_usdt" ? instructions.trim() || null : null,
    };

    const advertTrim = advertMessage.trim() ? advertMessage.trim().slice(0, 500) : null;

    let res =
      advertTrim !== null
        ? await supabase.rpc("merchant_create_offer", {
            ...baseArgs,
            p_advert_message: advertTrim,
          })
        : await supabase.rpc("merchant_create_offer", baseArgs);

    let droppedAdvertForLegacy = false;

    if (res.error && merchantCreateOfferMissingAdvertMigration(res.error)) {
      res = await supabase.rpc("merchant_create_offer", baseArgs);
      droppedAdvertForLegacy = Boolean(advertTrim);
    }

    setBusy(false);

    if (res.error) {
      setError(formatSupabaseError(res.error));
      return;
    }

    const qs = new URLSearchParams({ created: String(res.data ?? "") });
    if (droppedAdvertForLegacy) qs.set("adv_migration", "1");
    window.location.href = `/merchant?${qs.toString()}`;
  }

  const inp =
    "w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40 focus:ring-2 focus:ring-[#D4AF37]/22";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

  return (
    <MerchantAppShell
      heading="Publish listing"
      description="Form fields follow the merchant rail flow — segmented side, sideways numeric row, selectable payment chips, emerald submit."
    >
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
                aria-selected={side === "sell_usdt"}
                onClick={() => setSide("sell_usdt")}
                className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-bold uppercase leading-snug tracking-wide sm:text-xs sm:leading-tight md:py-3 ${
                  side === "sell_usdt"
                    ? "bg-red-600/90 text-white ring-1 ring-red-400/40"
                    : "text-zinc-400 hover:text-[#F5E6B3]"
                }`}
              >
                Sell USDT{" "}
                <span className="block font-medium normal-case text-[10px] text-zinc-500 sm:inline sm:font-normal sm:text-zinc-400">
                  (buyers get USDT)
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={side === "buy_usdt"}
                onClick={() => setSide("buy_usdt")}
                className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-center text-[11px] font-bold uppercase leading-snug tracking-wide sm:text-xs sm:leading-tight md:py-3 ${
                  side === "buy_usdt"
                    ? "bg-emerald-700 text-white ring-1 ring-emerald-400/40"
                    : "text-zinc-400 hover:text-[#F5E6B3]"
                }`}
              >
                Buy USDT{" "}
                <span className="block font-medium normal-case text-[10px] text-zinc-500 sm:inline sm:font-normal sm:text-zinc-400">
                  (you pay fiat)
                </span>
              </button>
            </div>
          </div>

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

          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="min-w-0 sm:col-span-1">
              <span className={label}>Min USDT</span>
              <input type="number" value={minL} onChange={(e) => setMinL(e.target.value)} className={`mt-2 ${inp}`} />
            </label>
            <label className="min-w-0 sm:col-span-1">
              <span className={label}>Max USDT</span>
              <input type="number" value={maxL} onChange={(e) => setMaxL(e.target.value)} className={`mt-2 ${inp}`} />
            </label>
            <label className="min-w-0 sm:col-span-2">
              <span className={label}>{side === "sell_usdt" ? "Buyer fee %" : "Fee % / margin"}</span>
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

          {side === "sell_usdt" ? (
            <label className="block">
              <span className={label}>Fiat payout instructions</span>
              <p className="mb-2 text-[11px] text-zinc-600">
                How buyers should send you fiat. Buy-USDT listings never store counterparty rails here — each seller posts
                their payout on the ticket.
              </p>
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
              <span className="font-semibold text-zinc-400">Buy-USDT listings:</span> pick chips above — investors paste
              their payout details inside each trade ticket.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/22 transition hover:bg-emerald-500 disabled:opacity-45"
          >
            {busy ? "Publishing…" : "Publish offer"}
          </button>
        </form>
      </div>
    </MerchantAppShell>
  );
}
