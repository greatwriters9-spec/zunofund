"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  MessageCircle,
  Wallet,
  ArrowDownCircle,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";

import { coerceRpcBigint, formatSupabaseError, useSupabase } from "@/lib/supabase";
import { notificationsOwnerOrFilter } from "@/lib/notificationQuery";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type FilterTab = "all" | "unread" | "read";

function typeStyles(type: string) {
  const t = type.toLowerCase();
  if (t.includes("support")) {
    return {
      Icon: MessageCircle,
      chip: "text-sky-300 bg-sky-500/15 border-sky-500/30",
      iconWrap: "bg-sky-500/10 text-sky-400",
    };
  }
  if (t.includes("deposit")) {
    return {
      Icon: Wallet,
      chip: "text-green-400 bg-green-500/15 border-green-500/30",
      iconWrap: "bg-green-500/10 text-green-400",
    };
  }
  if (t.includes("withdraw")) {
    return {
      Icon: ArrowDownCircle,
      chip: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      iconWrap: "bg-amber-500/10 text-amber-400",
    };
  }
  if (t.includes("profit")) {
    return {
      Icon: TrendingUp,
      chip: "text-violet-300 bg-violet-500/15 border-violet-500/30",
      iconWrap: "bg-violet-500/10 text-violet-400",
    };
  }
  if (t.includes("principal")) {
    return {
      Icon: TrendingUp,
      chip: "text-cyan-300 bg-cyan-500/15 border-cyan-500/35",
      iconWrap: "bg-cyan-500/10 text-cyan-400",
    };
  }
  if (t.includes("ticket")) {
    return {
      Icon: MessageCircle,
      chip: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      iconWrap: "bg-amber-500/12 text-amber-300",
    };
  }
  return {
    Icon: ShieldAlert,
    chip: "text-zinc-300 bg-zinc-800 border-zinc-700",
    iconWrap: "bg-zinc-800 text-yellow-500",
  };
}

export default function NotificationsPage() {
  const supabase = useSupabase();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const fetchNotifications = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;

    if (!background) {
      setLoading(true);
    }
    setFetchError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const email =
      typeof user?.email === "string" ? user.email.trim() : "";

    if (!user?.id || !email) {
      setNotifications([]);
      if (!background) setLoading(false);
      return;
    }

    const ownerFilter = notificationsOwnerOrFilter({
      userId: user.id,
      investorEmail: email,
    });

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .or(ownerFilter)
      .order("created_at", { ascending: false });

    if (error) {
      setNotifications([]);
      setFetchError(formatSupabaseError(error));
      if (!background) setLoading(false);
      return;
    }

    setNotifications((data as NotificationRow[]) || []);
    if (!background) setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const h = () => {
      void fetchNotifications({ background: true });
    };
    window.addEventListener("tp:investor-notification", h as EventListener);
    return () => {
      window.removeEventListener("tp:investor-notification", h as EventListener);
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.is_read !== true).length,
    [notifications],
  );

  const visibleList = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => n.is_read !== true);
    }
    if (filter === "read") {
      return notifications.filter((n) => n.is_read === true);
    }
    return notifications;
  }, [notifications, filter]);

  async function markAsRead(id: string) {
    setActionError(null);
    const { error, data } = await supabase.rpc(
      "mark_investor_notifications_read",
      { p_ids: [id] },
    );

    if (error) {
      setActionError(formatSupabaseError(error));
      return;
    }

    const updated = coerceRpcBigint(data);
    if (updated < 1) {
      await fetchNotifications({ background: true });
      window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification,
      ),
    );

    window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter((n) => n.is_read !== true)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    setActionError(null);
    const { error, data } = await supabase.rpc(
      "mark_investor_notifications_read",
      { p_ids: unreadIds },
    );

    if (error) {
      setActionError(formatSupabaseError(error));
      return;
    }

    const updated = coerceRpcBigint(data);
    if (updated < unreadIds.length) {
      await fetchNotifications({ background: true });
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, is_read: true }
          : notification,
      ),
    );

    window.dispatchEvent(new CustomEvent("tp:investor-notifications-sync"));
  }

  const tabCls = (t: FilterTab) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition border ${
      filter === t
        ? "bg-yellow-500 text-black border-yellow-500"
        : "bg-black/40 border-zinc-800 text-zinc-300 hover:border-zinc-600"
    }`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-zinc-400">
        Loading notifications…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl p-10">
        <h1 className="text-3xl font-bold text-yellow-500 mb-2">
          Notifications
        </h1>
        <p className="text-zinc-400 mb-10">
          Deposits, withdrawals, profits, and support replies in one place.
        </p>

        {(fetchError || actionError) && (
          <div
            className="mb-6 rounded-2xl border border-red-500/50 bg-red-500/10 px-6 py-4 text-red-300 text-sm"
            role="alert"
          >
            {fetchError || actionError}
          </div>
        )}

        <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 mb-1">Unread</p>
            <p className="text-2xl font-semibold text-white">
              {unreadCount === 0
                ? "You’re caught up"
                : `${unreadCount} notification${unreadCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-sm text-zinc-200 transition hover:border-yellow-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck size={18} />
              Mark all read
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-sm text-zinc-200 transition hover:border-yellow-500"
            >
              <ArrowLeft size={18} />
              Dashboard
            </Link>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 mb-8">
          <button type="button" className={tabCls("all")} onClick={() => setFilter("all")}>
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={tabCls("unread")}
            onClick={() => setFilter("unread")}
          >
            Unread ({notifications.filter((n) => n.is_read !== true).length})
          </button>
          <button type="button" className={tabCls("read")} onClick={() => setFilter("read")}>
            Read ({notifications.filter((n) => n.is_read === true).length})
          </button>
        </div>

        <div className="space-y-4">
          {visibleList.length > 0 ? (
            visibleList.map((notification) => {
              const { Icon, chip, iconWrap } = typeStyles(notification.type || "");
              const unread = notification.is_read !== true;
              const cardClassName = [
                "block w-full text-left rounded-2xl border p-6 transition",
                unread
                  ? "border-yellow-500/25 bg-zinc-950 hover:border-yellow-500/50 cursor-pointer"
                  : "border-zinc-800 bg-zinc-950/60 cursor-default",
              ].join(" ");
              const body = (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4 min-w-0">
                      <div className={`shrink-0 p-3 rounded-2xl ${iconWrap}`}>
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-white truncate">
                          {notification.title}
                        </h2>
                        <p
                          className={`inline-flex mt-2 text-xs capitalize rounded-lg px-3 py-1 border ${chip}`}
                        >
                          {(notification.type || "update").replace(/-/g, " ")}
                        </p>
                        <p className="text-zinc-300 text-sm leading-relaxed mt-4">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0 justify-between sm:justify-start">
                      {unread ? (
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-yellow-500"
                          aria-hidden
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">Read</span>
                      )}
                      <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </>
              );
              return unread ? (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={cardClassName}
                  title="Click to mark as read"
                >
                  {body}
                </button>
              ) : (
                <div key={notification.id} className={cardClassName}>
                  {body}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-8 py-16 text-center">
              <Bell className="mx-auto text-zinc-600 mb-5" size={48} strokeWidth={1.25} />
              <h2 className="text-xl font-semibold text-white mb-2">
                {filter === "unread"
                  ? "Nothing unread"
                  : filter === "read"
                    ? "No read notifications yet"
                    : "No notifications yet"}
              </h2>
              <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
                When admins approve payouts, support replies, or the system sends
                alerts, they will appear here.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-6 py-3 text-sm text-yellow-500 hover:border-yellow-500"
              >
                <ArrowLeft size={16} />
                Back to dashboard
              </Link>
            </div>
          )}
        </div>

        <p className="text-zinc-600 text-xs mt-12">
          Tip: unread items mark as read when you open them. Use “Mark all read” if
          you prefer to clear the badge without tapping each row.
        </p>
      </div>
    </div>
  );
}
