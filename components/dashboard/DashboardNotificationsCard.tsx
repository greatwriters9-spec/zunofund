"use client";

import Link from "next/link";

import { formatUsdAmountsInText } from "@/lib/formatMoney";

export type DashboardNotificationItem = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type DashboardNotificationsCardProps = {
  notifications: DashboardNotificationItem[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
};

export function DashboardNotificationsCard({
  notifications,
  unreadCount,
  onMarkRead,
}: DashboardNotificationsCardProps) {
  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40"
      aria-labelledby="dashboard-notifications-heading"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3">
        <h2
          id="dashboard-notifications-heading"
          className="text-[11px] font-medium uppercase tracking-wide text-zinc-500"
        >
          Notifications
        </h2>
        <Link
          href="/notifications"
          className="text-xs font-semibold text-yellow-500 transition hover:text-yellow-400"
        >
          View all
        </Link>
      </div>

      <div className="min-h-[300px] flex-1 overflow-y-auto">
        {notifications.length > 0 ? (
          <div className="divide-y divide-zinc-800/80">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => onMarkRead(notification.id)}
                className="w-full px-4 py-3 text-left transition hover:bg-zinc-900/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{notification.title}</h3>
                  {!notification.is_read ? (
                    <span
                      className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-zinc-500">
                  {formatUsdAmountsInText(notification.message)}
                </p>
                <p className="mt-2 text-[11px] tabular-nums text-zinc-600">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center px-4 py-10 text-center text-sm text-zinc-500">
            No notifications.
          </div>
        )}
      </div>

      {unreadCount > 0 ? (
        <div className="shrink-0 border-t border-zinc-800/80 px-4 py-2.5">
          <p className="text-xs text-zinc-500">
            {unreadCount > 99 ? "99+" : unreadCount} unread
          </p>
        </div>
      ) : null}
    </aside>
  );
}
