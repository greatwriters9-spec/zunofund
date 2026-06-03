"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search, X } from "lucide-react";

import {
  PAYMENT_METHOD_CATEGORIES,
  POPULAR_PAYMENT_METHODS,
  filterPaymentMethods,
  findPaymentMethodLabel,
  type PaymentMethodCategory,
  type PaymentMethodItem,
} from "@/components/payment-methods/paymentMethodsCatalog";

export type PaymentMethodsSheetProps = {
  open: boolean;
  /** Selected method code; use empty string for “all methods” when `allowAllMethods`. */
  selectedCode: string;
  onClose: () => void;
  onApply: (code: string, label: string) => void;
  allowAllMethods?: boolean;
  /** Optional extra class on the root overlay (e.g. `lg:hidden` for landing-only). */
  overlayClassName?: string;
  zIndexClass?: string;
};

export function PaymentMethodsSheet({
  open,
  selectedCode,
  onClose,
  onApply,
  allowAllMethods = false,
  overlayClassName = "",
  zIndexClass = "z-[250]",
}: PaymentMethodsSheetProps) {
  const [draftCode, setDraftCode] = useState(selectedCode);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<PaymentMethodCategory | null>(null);

  useEffect(() => {
    if (open) {
      setDraftCode(selectedCode);
      setSearch("");
      setActiveCategory(null);
    }
  }, [open, selectedCode]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PAYMENT_METHOD_CATEGORIES;
    return PAYMENT_METHOD_CATEGORIES.map((cat) => ({
      ...cat,
      methods: cat.methods.filter(
        (m) =>
          m.label.toLowerCase().includes(q) ||
          m.code.replace(/_/g, " ").toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.methods.length > 0);
  }, [search]);

  const categoryMethods = useMemo(() => {
    if (!activeCategory) return [];
    return filterPaymentMethods(search, activeCategory.id);
  }, [activeCategory, search]);

  if (!open) return null;

  const canApply = allowAllMethods ? true : Boolean(draftCode.trim());

  function handleApply() {
    if (!canApply) return;
    const code = draftCode.trim();
    onApply(code, findPaymentMethodLabel(code));
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 flex flex-col bg-[#05080F] ${zIndexClass} ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-label="Payment methods"
    >
      <div className="shrink-0 border-b border-zinc-800/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          {activeCategory ? (
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/80 text-zinc-300 transition hover:border-[#D4AF37]/40 hover:text-white"
              aria-label="Back to categories"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <span className="w-10" aria-hidden />
          )}
          <h2 className="flex-1 text-center text-lg font-bold text-white">
            {activeCategory ? activeCategory.label : "Payment methods"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/80 text-zinc-400 transition hover:border-[#D4AF37]/40 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-[#D4AF37]/45 focus:ring-1 focus:ring-[#D4AF37]/25"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4">
        {activeCategory ? (
          <MethodList methods={categoryMethods} selectedCode={draftCode} onSelect={setDraftCode} />
        ) : (
          <>
            {allowAllMethods && !search.trim() ? (
              <button
                type="button"
                onClick={() => setDraftCode("")}
                className={`mb-4 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition ${
                  draftCode === ""
                    ? "bg-[#D4AF37]/12 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
                    : "text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                <span>All payment methods</span>
                <SelectionDot active={draftCode === ""} />
              </button>
            ) : null}

            {!search.trim() ? (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold text-zinc-500">Most popular</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_PAYMENT_METHODS.map((method) => {
                    const active = draftCode === method.code;
                    return (
                      <button
                        key={method.code}
                        type="button"
                        onClick={() => setDraftCode(method.code)}
                        className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#F5E6B3]"
                            : "border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#E8D5A3] hover:border-[#D4AF37]/40"
                        }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <ul className="space-y-1">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;
                const count = cat.methods.length;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3.5 text-left transition hover:bg-white/[0.04]"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-[#D4AF37]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">{cat.label}</span>
                        <span className="mt-0.5 text-xs text-zinc-500">{count} options</span>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800/80 text-zinc-500">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {search.trim() && filteredCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No payment methods match your search.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-800/90 bg-[#05080F]/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <button
          type="button"
          disabled={!canApply}
          onClick={handleApply}
          className="w-full rounded-2xl bg-[linear-gradient(135deg,#F7E3A0_0%,#D4AF37_50%,#EAC54F_100%)] py-3.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.28)] transition enabled:hover:bg-[#E5BD45] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply & update offers
        </button>
      </div>
    </div>
  );
}

function SelectionDot({ active }: { active: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        active ? "border-[#D4AF37] bg-[#D4AF37]" : "border-zinc-600"
      }`}
      aria-hidden
    >
      {active ? <span className="h-2 w-2 rounded-full bg-black" /> : null}
    </span>
  );
}

function MethodList({
  methods,
  selectedCode,
  onSelect,
}: {
  methods: PaymentMethodItem[];
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  if (methods.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No methods in this category.</p>;
  }

  return (
    <ul className="space-y-1">
      {methods.map((method) => {
        const active = selectedCode === method.code;
        return (
          <li key={method.code}>
            <button
              type="button"
              onClick={() => onSelect(method.code)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition ${
                active
                  ? "bg-[#D4AF37]/12 text-[#F5E6B3] ring-1 ring-[#D4AF37]/35"
                  : "text-zinc-200 hover:bg-white/[0.04]"
              }`}
            >
              <span>{method.label}</span>
              <SelectionDot active={active} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
