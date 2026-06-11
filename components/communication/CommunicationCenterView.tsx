"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Megaphone, Search, ShieldCheck } from "lucide-react";

import { DASHBOARD_CARD, DASHBOARD_MUTED } from "@/components/dashboard/premium/dashboardStyles";
import { formatAnnouncementMonthYear } from "@/lib/platformConfig/helpers";
import {
  ANNOUNCEMENT_CATEGORIES,
  usePlatformConfig,
  type AnnouncementCategory,
} from "@/lib/platformConfig";

type FilterValue = "All" | AnnouncementCategory;

export function CommunicationCenterView() {
  const { config, loading } = usePlatformConfig();
  const [filter, setFilter] = useState<FilterValue>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return config.announcements.filter((item) => {
      if (filter !== "All" && item.category !== filter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [config.announcements, filter, search]);

  const filterOptions: FilterValue[] = ["All", ...ANNOUNCEMENT_CATEGORIES];

  return (
    <div className="page-content-stable min-h-screen bg-[#05070D] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8A93A5] transition hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to Dashboard
        </Link>

        <header className="mt-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/90">
              Zuno Official
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Communication Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
            Official announcements, promotion updates, platform news and growth milestones.
          </p>
        </header>

        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements…"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/40"
          />
        </div>

        <div
          className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Announcement categories"
        >
          {filterOptions.map((option) => {
            const active = filter === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(option)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5E6B3]"
                    : "border-white/[0.08] bg-white/[0.02] text-[#8A93A5] hover:border-[#D4AF37]/20 hover:text-white"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className={`${DASHBOARD_CARD} p-6 text-sm`} style={{ color: DASHBOARD_MUTED }}>
              Loading announcements…
            </div>
          ) : filtered.length === 0 ? (
            <div className={`${DASHBOARD_CARD} p-6 text-sm`} style={{ color: DASHBOARD_MUTED }}>
              No announcements match your search.
            </div>
          ) : (
            filtered.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className={`${DASHBOARD_CARD} p-5 sm:p-6`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#D4AF37]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                    {item.category}
                  </span>
                  {item.featured ? (
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold text-[#F5E6B3]">
                      Featured
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 text-base font-semibold text-white sm:text-lg">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs" style={{ color: DASHBOARD_MUTED }}>
                  {formatAnnouncementMonthYear(item.created_at)}
                </p>

                <p className="mt-3 text-sm leading-relaxed" style={{ color: DASHBOARD_MUTED }}>
                  {item.content}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4">
                  <ShieldCheck className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                  <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>
                    Posted by:{" "}
                    <span className="font-medium text-[#F5E6B3]">Zuno Administration</span>
                  </p>
                </div>
              </motion.article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
