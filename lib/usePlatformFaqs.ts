"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_PLATFORM_FAQS,
  normalizePlatformFaqRows,
  type PlatformFaq,
} from "@/lib/platformFaq";
import { useSupabase } from "@/lib/supabase";

export const PLATFORM_FAQS_CHANGED_EVENT = "zuno:platform-faqs-changed";

let cached: PlatformFaq[] | null = null;
let inflight: Promise<PlatformFaq[]> | null = null;
const subscribers = new Set<(faqs: PlatformFaq[]) => void>();

async function fetchFaqs(
  supabase: ReturnType<typeof useSupabase>,
): Promise<PlatformFaq[]> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("platform_faqs")
      .select("id, question, answer, sort_order, is_active, updated_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const next = error ? DEFAULT_PLATFORM_FAQS : normalizePlatformFaqRows(data);

    if (!error) cached = next;
    subscribers.forEach((cb) => cb(next));
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidatePlatformFaqsCache(): void {
  cached = null;
  inflight = null;
}

export function usePlatformFaqs(): {
  faqs: PlatformFaq[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const supabase = useSupabase();
  const [faqs, setFaqs] = useState<PlatformFaq[]>(
    () => cached ?? DEFAULT_PLATFORM_FAQS,
  );
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    invalidatePlatformFaqsCache();
    setLoading(true);
    const next = await fetchFaqs(supabase);
    setFaqs(next);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    function onUpdate(next: PlatformFaq[]) {
      if (mounted) setFaqs(next);
    }

    subscribers.add(onUpdate);

    void fetchFaqs(supabase).then((next) => {
      if (mounted) {
        setFaqs(next);
        setLoading(false);
      }
    });

    function onExternalChange() {
      void refresh();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === PLATFORM_FAQS_CHANGED_EVENT) {
        void refresh();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    window.addEventListener(PLATFORM_FAQS_CHANGED_EVENT, onExternalChange);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const channel = supabase
      .channel("platform-faqs-contact-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_faqs" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      subscribers.delete(onUpdate);
      window.removeEventListener(PLATFORM_FAQS_CHANGED_EVENT, onExternalChange);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  return { faqs, loading, refresh };
}
