"use client";

import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { ArrowUpRight, BadgeCheck, Globe2, Users, Wallet } from "lucide-react";

interface CountUpProps {
  to: number;
  /** Decimal places. Default 0. */
  decimals?: number;
  /** Optional currency-style formatting (USD, no fractional unless decimals > 0). */
  currency?: boolean;
  prefix?: string;
  suffix?: string;
  durationSec?: number;
}

function CountUp({
  to,
  decimals = 0,
  currency = false,
  prefix = "",
  suffix = "",
  durationSec = 1.8,
}: CountUpProps) {
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (value) => {
    if (currency) {
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      });
    }
    return value.toLocaleString("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
  });

  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, to, {
      duration: durationSec,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [inView, to, motionValue, durationSec]);

  return (
    <span ref={ref} className="inline-flex tabular-nums">
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

interface Stat {
  label: string;
  value: number;
  decimals?: number;
  currency?: boolean;
  prefix?: string;
  suffix?: string;
  icon: typeof Wallet;
  trend: string;
}

const STATS: Stat[] = [
  {
    label: "Capital under management",
    value: 158_492_000,
    currency: true,
    decimals: 0,
    suffix: "+",
    icon: Wallet,
    trend: "USD across global portfolios",
  },
  {
    label: "Profits distributed",
    value: 24_580_000,
    currency: true,
    decimals: 0,
    suffix: "+",
    icon: ArrowUpRight,
    trend: "Paid to active investors to date",
  },
  {
    label: "Active investors",
    value: 2_412,
    suffix: "+",
    icon: Users,
    trend: "Across 38 countries",
  },
  {
    label: "Withdrawal success",
    value: 99.8,
    decimals: 1,
    suffix: "%",
    icon: BadgeCheck,
    trend: "Settled within 24 hours",
  },
];

export function HeadlineStats() {
  return (
    <section
      aria-labelledby="headline-stats-heading"
      className="relative px-6 py-16 lg:px-12 lg:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-xs font-medium text-[#D4AF37]">
              <Globe2 size={14} aria-hidden />
              By the numbers
            </div>
            <h2
              id="headline-stats-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
            >
              Above the{" "}
              <span className="text-[#D4AF37]">$150M USDT</span> mark
              <span className="text-[#D4AF37]">.</span>{" "}
              <span className="text-gray-300">And moving on.</span>
            </h2>
            <p className="mt-3 text-sm text-gray-400 sm:text-base">
              Real money, real investors, real settlements — Zuno&rsquo;s
              portfolio continues to scale across global markets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ label, value, decimals, currency, prefix, suffix, icon: Icon, trend }) => (
            <div
              key={label}
              className="group relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/70 p-6 backdrop-blur-xl transition duration-300 hover:border-[#D4AF37]/40"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#D4AF37]/5 blur-3xl transition group-hover:bg-[#D4AF37]/10" />

              <div className="relative">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10">
                  <Icon size={20} className="text-[#D4AF37]" aria-hidden />
                </div>

                <div className="text-[28px] font-black leading-none tracking-tight text-white sm:text-[32px]">
                  <CountUp
                    to={value}
                    decimals={decimals}
                    currency={currency}
                    prefix={prefix}
                    suffix={suffix}
                  />
                </div>

                <p className="mt-3 text-sm font-medium text-gray-300">
                  {label}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {trend}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
