"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import {
  filterPaymentMethods,
  type PaymentMethodItem,
} from "@/components/payment-methods/paymentMethodsCatalog";

export type PaymentMethodsDropdownProps = {
  open: boolean;
  selectedCode: string;
  onClose: () => void;
  onSelect: (code: string) => void;
  allowAllMethods?: boolean;
};

export function PaymentMethodsDropdown({
  open,
  selectedCode,
  onClose,
  onSelect,
  allowAllMethods = true,
}: PaymentMethodsDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  const filtered = useMemo(() => filterPaymentMethods(search), [search]);

  if (!open) return null;

  function pickMethod(code: string) {
    onSelect(code);
    onClose();
  }

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Payment methods"
      className="absolute left-0 top-[calc(100%+6px)] z-[120] flex w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c1018] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md"
    >
      <div className="relative shrink-0 border-b border-white/[0.06] p-2">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          autoFocus
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/80 py-2 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-[#D4AF37]/45"
        />
      </div>

      <ul className="max-h-[min(360px,55dvh)] overflow-y-auto overscroll-contain py-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5">
        {allowAllMethods ? (
          <li>
            <button
              type="button"
              onClick={() => pickMethod("")}
              className={`block w-full px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.05] ${
                selectedCode === "" ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
              }`}
            >
              All payment methods
            </button>
          </li>
        ) : null}

        {filtered.map((method) => (
          <MethodRow
            key={method.code}
            method={method}
            active={selectedCode === method.code}
            onSelect={() => pickMethod(method.code)}
          />
        ))}

        {filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-zinc-500">No match</li>
        ) : null}
      </ul>
    </div>
  );
}

function MethodRow({
  method,
  active,
  onSelect,
}: {
  method: PaymentMethodItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`block w-full px-3 py-2 text-left text-[13px] transition hover:bg-white/[0.05] ${
          active ? "bg-[#D4AF37]/10 text-[#F5E6B3]" : "text-zinc-300"
        }`}
      >
        {method.label}
      </button>
    </li>
  );
}
