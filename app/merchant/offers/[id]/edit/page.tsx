"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MerchantAppShell } from "@/components/merchant/MerchantAppShell";
import { MerchantOfferForm, type MerchantOfferFormInitial } from "@/components/merchant/MerchantOfferForm";
import { formatSupabaseError, useSupabase } from "@/lib/supabase";

export default function MerchantEditOfferPage() {
  const supabase = useSupabase();
  const params = useParams();
  const offerId = typeof params.id === "string" ? params.id : "";

  const [initial, setInitial] = useState<MerchantOfferFormInitial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!offerId) {
      setLoading(false);
      setError("Invalid listing id.");
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) {
          setError("Sign in to edit listings.");
          setLoading(false);
        }
        return;
      }

      const { data, error: qErr } = await supabase
        .from("merchant_offers")
        .select(
          "id, side, payment_methods, min_limit, max_limit, rate_percentage, payment_instructions, advert_message, fiat_currency_code, merchant_user_id",
        )
        .eq("id", offerId)
        .maybeSingle();

      if (cancelled) return;
      setLoading(false);

      if (qErr) {
        setError(formatSupabaseError(qErr));
        return;
      }

      if (!data || data.merchant_user_id !== session.user.id) {
        setError("Listing not found.");
        return;
      }

      setInitial({
        offerId: data.id as string,
        side: String(data.side),
        payment_methods: Array.isArray(data.payment_methods) ? [...(data.payment_methods as string[])] : [],
        min_limit: Number(data.min_limit),
        max_limit: Number(data.max_limit),
        rate_percentage: Number(data.rate_percentage),
        payment_instructions:
          typeof data.payment_instructions === "string" ? data.payment_instructions : null,
        advert_message: typeof data.advert_message === "string" ? data.advert_message : null,
        fiat_currency_code:
          typeof data.fiat_currency_code === "string" ? data.fiat_currency_code : null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [offerId, supabase]);

  return (
    <MerchantAppShell
      heading="Edit listing"
      description="Update limits, fee, payment rails, advert, and payout instructions. Asset and side stay fixed."
    >
      {loading ? (
        <p className="text-sm text-zinc-500">Loading listing…</p>
      ) : error ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}{" "}
          <Link href="/merchant" className="font-semibold text-[#D4AF37] hover:underline">
            Back to console
          </Link>
        </div>
      ) : initial ? (
        <MerchantOfferForm mode="edit" initial={initial} />
      ) : null}
    </MerchantAppShell>
  );
}
