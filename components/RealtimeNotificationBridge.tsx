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
  const recentInvestorNotifIdsRef = useRef(new Set<string>());
  const lastInvestorSyncAtRef = useRef(0);

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

      const uid = session.user.id;
      const emailNorm = session.user.email?.trim().toLowerCase() ?? "";

      invChannelRef.current?.unsubscribe();

      function dispatchInvestorInsert(row: Record<string, unknown>) {
        const id = typeof row.id === "string" ? row.id : null;
        if (id) {
          if (recentInvestorNotifIdsRef.current.has(id)) return;
          recentInvestorNotifIdsRef.current.add(id);
          window.setTimeout(() => {
            recentInvestorNotifIdsRef.current.delete(id);
          }, 2500);
        }

        const notificationType =
          typeof row.type === "string" ? row.type : "";

        document.dispatchEvent(
          new CustomEvent("tp:investor-notification", { detail: row }),
        );

        if (isAdminDesk) return;

        playInvestorNotificationSound(notificationType);
      }

      function dispatchInvestorSync() {
        const now = Date.now();
        if (now - lastInvestorSyncAtRef.current < 450) return;
        lastInvestorSyncAtRef.current = now;

        document.dispatchEvent(
          new CustomEvent("tp:investor-notifications-sync"),
        );
      }

      let invChannel = supabase.channel(`investor-live-notifications:${uid}`);

      invChannel = invChannel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        (payload: PostgresInsertPayload) => {
          dispatchInvestorInsert(payload.new ?? {});
        },
      );

      invChannel = invChannel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${uid}`,
        },
        dispatchInvestorSync,
      );

      if (emailNorm.length > 0) {
        invChannel = invChannel.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `investor_email=eq.${emailNorm}`,
          },
          (payload: PostgresInsertPayload) => {
            dispatchInvestorInsert(payload.new ?? {});
          },
        );

        invChannel = invChannel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `investor_email=eq.${emailNorm}`,
          },
          dispatchInvestorSync,
        );
      }

      invChannelRef.current = invChannel.subscribe();

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
