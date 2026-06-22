"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";

import type { AdminNotificationRow } from "@/lib/adminCommunication/types";
import { useSupabase } from "@/lib/supabase";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminNotificationBell() {
  const supabase = useSupabase();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data as AdminNotificationRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("tp:admin-notification", reload);
    return () => window.removeEventListener("tp:admin-notification", reload);
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    await supabase.rpc("admin_mark_notifications_read", { p_ids: [id] });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
  }

  async function markAllRead() {
    await supabase.rpc("admin_mark_all_notifications_read");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[#F5E6B3] transition hover:border-[#D4AF37]/30"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-12 z-50 w-[min(100vw-2rem,380px)] rounded-2xl border border-white/10 bg-[#0A0F18] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-[#F5E6B3]">Notifications</p>
              <div className="flex items-center gap-1">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-[#F5E6B3]"
                    title="Mark all read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-white/5 px-4 py-3 ${
                      !n.is_read ? "bg-[#D4AF37]/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#F5E6B3]">{n.title}</p>
                      {!n.is_read ? (
                        <button
                          type="button"
                          onClick={() => void markRead(n.id)}
                          className="shrink-0 text-[10px] text-[#D4AF37]"
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-zinc-400">{n.message}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">{formatWhen(n.created_at)}</p>
                    {n.action_link ? (
                      <Link
                        href={n.action_link}
                        onClick={() => {
                          void markRead(n.id);
                          setOpen(false);
                        }}
                        className="mt-1 inline-block text-[11px] font-medium text-[#D4AF37]"
                      >
                        View details →
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/10 px-4 py-2">
              <Link
                href="/admin/communication"
                onClick={() => setOpen(false)}
                className="block py-2 text-center text-xs font-semibold text-[#D4AF37]"
              >
                Open Communication Center
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
