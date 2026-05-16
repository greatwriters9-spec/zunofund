"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSupabase } from "@/lib/supabase";
import {
  playAdminNotificationSound,
  playInvestorNotificationSound,
} from "@/lib/notifications/sounds";

type PostgresInsertPayload = {
  new?: Record<string, unknown>;
};

function readString(o: Record<string, unknown>, key: string) {
  const v = o[key];
  return typeof v === "string" ? v : null;
}

/**
 * Streams Supabase realtime inserts while the session stays logged-in (no reload).
 * Investor inserts fire `tp:investor-notification` for dashboards to reconcile counts.
 * Admin inserts fire `tp:admin-notification` for desks plus a louder cue within `/admin`.
 */
export function RealtimeNotificationBridge() {
  const supabase = useSupabase();
  const pathname = usePathname();
  const invChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const admChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function wire() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || cancelled) {
        return;
      }

      const isAdminDesk =
        pathname?.startsWith("/admin") === true &&
        !pathname.startsWith("/admin-login");

      invChannelRef.current?.unsubscribe();

      invChannelRef.current = supabase
        .channel(`investor-live-notifications:${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
          },
          (payload: PostgresInsertPayload) => {
            const row = payload.new ?? {};
            const notificationType =
              typeof row.type === "string" ? row.type : "";

            document.dispatchEvent(
              new CustomEvent("tp:investor-notification", { detail: row }),
            );

            if (isAdminDesk) return;

            playInvestorNotificationSound(notificationType);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
          },
          () => {
            document.dispatchEvent(
              new CustomEvent("tp:investor-notifications-sync"),
            );
          },
        )
        .subscribe();

      if (isAdminDesk) {
        admChannelRef.current?.unsubscribe();

        admChannelRef.current = supabase
          .channel(`admin-live-notifications:${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "admin_notifications",
            },
            (payload: PostgresInsertPayload) => {
              const row = payload.new ?? {};
              document.dispatchEvent(
                new CustomEvent("tp:admin-notification", {
                  detail: row,
                }),
              );
              playAdminNotificationSound(readString(row, "type") ?? "");
            },
          )
          .subscribe();
      } else {
        admChannelRef.current?.unsubscribe();
        admChannelRef.current = null;
      }
    }

    void wire();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void wire();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      invChannelRef.current?.unsubscribe();
      admChannelRef.current?.unsubscribe();
    };
  }, [pathname, supabase]);

  return null;
}
