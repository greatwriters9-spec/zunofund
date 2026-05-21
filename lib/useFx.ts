"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_FIAT_CURRENCY,
  type FiatCurrencyCode,
  isFiatCurrencyCode,
} from "@/lib/currencies";
import type { P2pAssetCode } from "@/lib/p2pAssets";
import type { FxRateMap } from "@/lib/exchangeRates";

const DISPLAY_CURRENCY_STORAGE_KEY = "zuno_display_currency";
const DISPLAY_CURRENCY_EVENT = "zuno:display-currency-changed";

// ---------------------------------------------------------------------------
// useFxRates — module-level cache so a page render doesn't fan out one
// network round-trip per consumer. First mount fetches; subsequent mounts
// resolve immediately from `cachedRates`.
// ---------------------------------------------------------------------------

let cachedRates: FxRateMap | null = null;
let cachedFetchedAt: string | null = null;
let inflight: Promise<FxRateMap> | null = null;
const fxSubscribers = new Set<(rates: FxRateMap) => void>();

const FALLBACK_RATES: FxRateMap = { USD: 1, USDT: 1 };

async function loadFxRates(): Promise<FxRateMap> {
  if (cachedRates) return cachedRates;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const resp = await fetch("/api/market/fx", { cache: "no-store" });
      if (!resp.ok) throw new Error(`fx ${resp.status}`);
      const json = (await resp.json()) as { rates?: FxRateMap; fetched_at?: string | null };
      const merged: FxRateMap = { ...FALLBACK_RATES, ...(json.rates ?? {}) };
      cachedRates = merged;
      cachedFetchedAt = json.fetched_at ?? null;
      fxSubscribers.forEach((cb) => cb(merged));
      return merged;
    } catch {
      const fallback = { ...FALLBACK_RATES };
      cachedRates = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useFxRates(): { rates: FxRateMap; fetchedAt: string | null } {
  const [rates, setRates] = useState<FxRateMap>(() => cachedRates ?? FALLBACK_RATES);
  const [fetchedAt, setFetchedAt] = useState<string | null>(cachedFetchedAt);

  useEffect(() => {
    let mounted = true;
    function onUpdate(r: FxRateMap) {
      if (mounted) {
        setRates(r);
        setFetchedAt(cachedFetchedAt);
      }
    }
    fxSubscribers.add(onUpdate);
    void loadFxRates().then((r) => {
      if (mounted) {
        setRates(r);
        setFetchedAt(cachedFetchedAt);
      }
    });
    return () => {
      mounted = false;
      fxSubscribers.delete(onUpdate);
    };
  }, []);

  return { rates, fetchedAt };
}

/** Imperative helper for non-React call sites (e.g. submit handlers). */
export async function getFxRates(): Promise<FxRateMap> {
  return loadFxRates();
}

// ---------------------------------------------------------------------------
// useDisplayCurrency — the user's preferred fiat for balances + amount
// previews. Persisted in `localStorage` and broadcast across tabs/components
// so the dashboard and marketplace stay in sync without prop drilling.
// ---------------------------------------------------------------------------

export function useDisplayCurrency(): [FiatCurrencyCode, (next: FiatCurrencyCode) => void] {
  const [code, setCode] = useState<FiatCurrencyCode>(DEFAULT_FIAT_CURRENCY);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
      if (stored && isFiatCurrencyCode(stored)) setCode(stored);
    } catch {
      /* localStorage unavailable — keep default */
    }

    function onCustom(e: Event) {
      const next = (e as CustomEvent<unknown>).detail;
      if (typeof next === "string" && isFiatCurrencyCode(next)) setCode(next);
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== DISPLAY_CURRENCY_STORAGE_KEY) return;
      if (typeof e.newValue === "string" && isFiatCurrencyCode(e.newValue)) setCode(e.newValue);
    }
    window.addEventListener(DISPLAY_CURRENCY_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DISPLAY_CURRENCY_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function setNext(next: FiatCurrencyCode) {
    setCode(next);
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(DISPLAY_CURRENCY_EVENT, { detail: next }));
    } catch {
      /* ignore */
    }
  }

  return [code, setNext];
}

// ---------------------------------------------------------------------------
// useDisplayCryptoUnit — headline balance in USDT or BTC (investment balance
// is USD-pegged; BTC view converts via the live BTC/USD rate).
// ---------------------------------------------------------------------------

const DISPLAY_CRYPTO_STORAGE_KEY = "zuno_display_crypto";
const DISPLAY_CRYPTO_EVENT = "zuno:display-crypto-changed";

const VALID_CRYPTO_UNITS: readonly P2pAssetCode[] = ["USDT", "BTC"];

function isDisplayCryptoUnit(v: string): v is P2pAssetCode {
  return (VALID_CRYPTO_UNITS as readonly string[]).includes(v);
}

export function useDisplayCryptoUnit(): [P2pAssetCode, (next: P2pAssetCode) => void] {
  const [unit, setUnit] = useState<P2pAssetCode>("USDT");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISPLAY_CRYPTO_STORAGE_KEY);
      if (stored && isDisplayCryptoUnit(stored)) setUnit(stored);
    } catch {
      /* ignore */
    }

    function onCustom(e: Event) {
      const next = (e as CustomEvent<unknown>).detail;
      if (typeof next === "string" && isDisplayCryptoUnit(next)) setUnit(next);
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== DISPLAY_CRYPTO_STORAGE_KEY) return;
      if (typeof e.newValue === "string" && isDisplayCryptoUnit(e.newValue)) setUnit(e.newValue);
    }
    window.addEventListener(DISPLAY_CRYPTO_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DISPLAY_CRYPTO_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function setNext(next: P2pAssetCode) {
    if (!isDisplayCryptoUnit(next)) return;
    setUnit(next);
    try {
      window.localStorage.setItem(DISPLAY_CRYPTO_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(DISPLAY_CRYPTO_EVENT, { detail: next }));
    } catch {
      /* ignore */
    }
  }

  return [unit, setNext];
}
