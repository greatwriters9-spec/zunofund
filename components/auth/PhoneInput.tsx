"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  DEFAULT_PHONE_COUNTRY,
  detectPhoneCountryIso,
  getPhoneCountry,
  isValidPhoneE164,
  nationalDigitsFromInput,
  toE164,
  type PhoneCountry,
  PHONE_COUNTRIES,
} from "@/lib/phoneCountries";

type PhoneInputProps = {
  value: string;
  onChange: (e164: string) => void;
  error?: boolean;
  className?: string;
};

export function validatePhoneValue(e164: string, countryIso: string): boolean {
  return isValidPhoneE164(e164, countryIso);
}

export function PhoneInput({ value, onChange, error, className }: PhoneInputProps) {
  const listId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [countryIso, setCountryIso] = useState(DEFAULT_PHONE_COUNTRY);
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);

  const country = useMemo(() => getPhoneCountry(countryIso), [countryIso]);
  const prefix = `+${country.dial}`;

  useEffect(() => {
    setCountryIso(detectPhoneCountryIso());
  }, []);

  useEffect(() => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setNational("");
      return;
    }
    const c = getPhoneCountry(countryIso);
    if (digits.startsWith(c.dial)) {
      setNational(digits.slice(c.dial.length));
      return;
    }
    for (const pc of PHONE_COUNTRIES) {
      if (digits.startsWith(pc.dial)) {
        setCountryIso(pc.iso2);
        setNational(digits.slice(pc.dial.length));
        return;
      }
    }
  }, [value, countryIso]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const emit = useCallback(
    (c: PhoneCountry, nat: string) => {
      onChange(toE164(c, nat));
    },
    [onChange],
  );

  function pickCountry(iso: string) {
    const next = getPhoneCountry(iso);
    setCountryIso(iso);
    setOpen(false);
    emit(next, national);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleNationalChange(raw: string) {
    const digits = nationalDigitsFromInput(raw).slice(0, country.maxLen);
    setNational(digits);
    emit(country, digits);
  }

  function handleNationalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    if ((e.key === "Backspace" || e.key === "Delete") && start === 0) {
      e.preventDefault();
    }
  }

  function handleNationalPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    let digits = nationalDigitsFromInput(pasted);
    if (pasted.trim().startsWith("+")) {
      const all = pasted.replace(/\D/g, "");
      for (const pc of PHONE_COUNTRIES) {
        if (all.startsWith(pc.dial)) {
          setCountryIso(pc.iso2);
          digits = all.slice(pc.dial.length);
          emit(pc, digits);
          setNational(digits.slice(0, pc.maxLen));
          return;
        }
      }
    }
    digits = digits.slice(0, country.maxLen);
    setNational(digits);
    emit(country, digits);
  }

  const fieldBorder = error
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "border-zinc-700 focus-within:border-yellow-500";
  const shellBorder = error
    ? "sm:border-red-500 sm:shadow-[0_0_20px_rgba(239,68,68,0.35)]"
    : "sm:border-zinc-700 sm:focus-within:border-yellow-500";

  return (
    <div
      className={`flex w-full min-w-0 flex-col gap-2 overflow-visible sm:flex-row sm:items-stretch sm:gap-0 sm:rounded-2xl sm:border sm:bg-zinc-900 ${shellBorder} ${className ?? ""}`}
    >
      <div
        ref={pickerRef}
        className={`relative z-30 min-w-0 shrink-0 overflow-visible rounded-2xl border bg-zinc-900 sm:w-[5.75rem] sm:rounded-none sm:border-0 sm:border-r sm:border-zinc-700 ${fieldBorder}`}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${country.name}, dial code +${country.dial}`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-[5.75rem] items-center justify-center gap-1.5 px-2 py-4 text-white outline-none hover:bg-zinc-800/80 sm:py-4"
        >
          <span className="text-xl leading-none" aria-hidden>
            {country.flag}
          </span>
          <span className="text-sm font-semibold tabular-nums text-zinc-200">+{country.dial}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Country dial codes"
            className="absolute left-0 top-full z-50 mt-1 max-h-52 w-[8.5rem] overflow-y-auto rounded-xl border border-zinc-600 bg-zinc-900 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.65)] [scrollbar-width:thin]"
          >
            {PHONE_COUNTRIES.map((c) => {
              const selected = c.iso2 === countryIso;
              return (
                <li key={c.iso2} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => pickCountry(c.iso2)}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition ${
                      selected
                        ? "bg-yellow-500/15 text-yellow-300"
                        : "text-white hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-lg leading-none">{c.flag}</span>
                    <span className="text-sm font-semibold tabular-nums">+{c.dial}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div
        className={`flex min-w-0 flex-1 items-center overflow-visible rounded-2xl border bg-zinc-900 sm:rounded-none sm:border-0 ${fieldBorder}`}
      >
        <span className="shrink-0 select-none pl-4 text-sm tabular-nums text-zinc-400" aria-hidden>
          {prefix}
        </span>
        <label htmlFor={inputId} className="sr-only">
          Phone number
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="700 000 000"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
          onKeyDown={handleNationalKeyDown}
          onPaste={handleNationalPaste}
          aria-invalid={error || undefined}
          className="min-w-0 flex-1 border-0 bg-transparent py-4 pr-4 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
