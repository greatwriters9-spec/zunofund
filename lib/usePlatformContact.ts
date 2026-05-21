"use client";

import { useCallback, useEffect, useState } from "react";

import {
  EMPTY_PLATFORM_CONTACT,
  PLATFORM_CONTACT_ID,
  normalizePlatformContactRow,
  type PlatformContact,
} from "@/lib/platformContact";
import { useSupabase } from "@/lib/supabase";

export const PLATFORM_CONTACT_CHANGED_EVENT = "zuno:platform-contact-changed";

let cached: PlatformContact | null = null;
let inflight: Promise<PlatformContact> | null = null;
const subscribers = new Set<(c: PlatformContact) => void>();

async function fetchContact(
  supabase: ReturnType<typeof useSupabase>,
): Promise<PlatformContact> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("platform_contact_settings")
      .select("support_email, support_phone, whatsapp, telegram, updated_at")
      .eq("id", PLATFORM_CONTACT_ID)
      .maybeSingle();

    const next = error
      ? { ...EMPTY_PLATFORM_CONTACT }
      : normalizePlatformContactRow(data ?? undefined);

    cached = next;
    subscribers.forEach((cb) => cb(next));
    return next;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidatePlatformContactCache(): void {
  cached = null;
  inflight = null;
}

export function usePlatformContact(): {
  contact: PlatformContact;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const supabase = useSupabase();
  const [contact, setContact] = useState<PlatformContact>(
    () => cached ?? EMPTY_PLATFORM_CONTACT,
  );
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    invalidatePlatformContactCache();
    setLoading(true);
    const next = await fetchContact(supabase);
    setContact(next);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    function onUpdate(c: PlatformContact) {
      if (mounted) setContact(c);
    }

    subscribers.add(onUpdate);

    void fetchContact(supabase).then((c) => {
      if (mounted) {
        setContact(c);
        setLoading(false);
      }
    });

    function onExternalChange() {
      void refresh();
    }

    window.addEventListener(PLATFORM_CONTACT_CHANGED_EVENT, onExternalChange);

    return () => {
      mounted = false;
      subscribers.delete(onUpdate);
      window.removeEventListener(PLATFORM_CONTACT_CHANGED_EVENT, onExternalChange);
    };
  }, [supabase, refresh]);

  return { contact, loading, refresh };
}
