"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  Eye,
  Headphones,
  Home,
  LayoutList,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiTether } from "react-icons/si";

import { WorldMapVisual } from "@/components/landing/WorldMapVisual";

const LAPTOP_OFFERS = [
  {
    merchant: "AlphaTrader",
    rating: "98% | 1245 trades",
    payment: "Bank Transfer",
    price: "KES 129.80",
    available: "1,250.00 USDT",
    limit: "5,000 - 150,000 KES",
  },
  {
    merchant: "SafeP2P",
    rating: "97% | 892 trades",
    payment: "M-PESA",
    price: "KES 128.50",
    available: "2,800.00 USDT",
    limit: "10,000 - 250,000 KES",
  },
  {
    merchant: "RapidExchange",
    rating: "99% | 2104 trades",
    payment: "Airtel Money",
    price: "KES 130.05",
    available: "950.00 USDT",
    limit: "3,000 - 80,000 KES",
  },
] as const;

const PHONE_ASSETS = [
  {
    symbol: "USDT",
    name: "Tether",
    value: "$68,315.00",
    amount: "68,315.00 USDT",
    Icon: SiTether,
    iconClass: "text-[#26A17B]",
    glow: "shadow-[0_0_12px_rgba(38,161,123,0.35)]",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    value: "$86,120.00",
    amount: "1.234567 BTC",
    Icon: SiBitcoin,
    iconClass: "text-[#F7931A]",
    glow: "shadow-[0_0_12px_rgba(247,147,26,0.35)]",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    value: "$53,065.00",
    amount: "15.1254 ETH",
    Icon: SiEthereum,
    iconClass: "text-[#627EEA]",
    glow: "shadow-[0_0_12px_rgba(98,126,234,0.35)]",
  },
] as const;

function MockupZunoBrand({ variant }: { variant: "phone" | "laptop" }) {
  const isLaptop = variant === "laptop";

  return (
    <div className={`flex shrink-0 items-center ${isLaptop ? "gap-3" : "gap-2.5"}`}>
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/10 ring-1 ring-[#D4AF37]/30 ${
          isLaptop ? "h-9 w-9 p-1.5" : "h-7 w-7 p-1"
        }`}
      >
        <Image
          src="/logo.png"
          alt=""
          width={isLaptop ? 28 : 22}
          height={isLaptop ? 28 : 22}
          className={`object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.5)] ${
            isLaptop ? "h-6 w-6" : "h-5 w-5"
          }`}
        />
      </div>
      <span
        className={`gold-gradient font-bold leading-none tracking-[0.26em] ${
          isLaptop ? "text-[17px]" : "text-[14px]"
        }`}
      >
        ZUNO
      </span>
    </div>
  );
}

function HeroPhoneDashboard() {
  return (
    <div className="flex h-full flex-col bg-[#060B14]">
      <div className="flex items-center justify-between px-4 pb-1 pt-9">
        <MockupZunoBrand variant="phone" />
        <Settings className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
      </div>

      <div className="mt-4 px-4">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-400">My Balances</p>
          <Eye className="h-3 w-3 text-zinc-500" aria-hidden />
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">Total Balance</p>
        <p className="mt-1 text-[1.55rem] font-bold tabular-nums leading-none text-white">$207,500.00</p>
        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
          <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
          + 4.2% today
        </p>
      </div>

      <div className="mt-5 flex-1 space-y-2.5 overflow-hidden px-4">
        {PHONE_ASSETS.map(({ symbol, name, value, amount, Icon, iconClass, glow }) => (
          <div
            key={symbol}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-3 backdrop-blur-sm"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-black/30 ${glow}`}
            >
              <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-white">{symbol}</p>
                <p className="text-[11px] font-semibold tabular-nums text-white">{value}</p>
              </div>
              <p className="mt-0.5 truncate text-[9px] text-zinc-500">{name}</p>
              <p className="mt-0.5 text-[9px] tabular-nums text-zinc-400">{amount}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4 pb-3 pt-2">
        <div className="rounded-xl bg-[#D4AF37] py-2.5 text-center text-[10px] font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]">
          Deposit
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-center text-[10px] font-semibold text-white">
          Withdraw
        </div>
      </div>

      <div className="mt-auto border-t border-white/[0.06] bg-[#05080F]/90 px-2 py-2.5">
        <div className="grid grid-cols-5 items-center gap-1 text-center">
          {[
            { label: "Home", icon: Home, active: false },
            { label: "P2P", icon: LayoutList, active: false },
            { label: "Orders", icon: Store, active: false },
            { label: "Wallet", icon: Wallet, active: true },
            { label: "Profile", icon: User, active: false },
          ].map(({ label, icon: NavIcon, active }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <NavIcon
                className={`h-3.5 w-3.5 ${active ? "text-[#D4AF37]" : "text-zinc-500"}`}
                aria-hidden
              />
              <span className={`text-[7px] font-medium ${active ? "text-[#D4AF37]" : "text-zinc-500"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroLaptopDashboard() {
  return (
    <div className="flex min-h-[460px] flex-col bg-[#060B14] text-white">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <MockupZunoBrand variant="laptop" />
        <div className="flex items-center gap-4 text-[8px] font-medium text-zinc-500">
          <span className="border-b border-[#D4AF37] pb-0.5 text-white">P2P Marketplace</span>
          <span>My Orders</span>
          <span>My Ads</span>
          <span>Dashboard</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Headphones className="h-3 w-3 text-zinc-500" aria-hidden />
          <Bell className="h-3 w-3 text-zinc-500" aria-hidden />
          <div className="h-5 w-5 rounded-full bg-[#D4AF37]/20 ring-1 ring-[#D4AF37]/40" />
        </div>
      </div>

      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <h2 className="text-base font-bold text-white">P2P Marketplace</h2>
          <p className="mt-1 text-[9px] text-zinc-400">Buy and sell crypto securely with zero fees</p>
        </div>
        <div className="rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[9px] font-bold text-black shadow-[0_0_16px_rgba(212,175,55,0.28)]">
          Create Ad
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 px-4">
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          <span className="rounded-md bg-[#D4AF37] px-3 py-1 text-[8px] font-bold text-black">Buy</span>
          <span className="px-3 py-1 text-[8px] font-medium text-zinc-500">Sell</span>
        </div>
        {["USDT", "All Payment Methods", "All Regions", "Amount"].map((filter) => (
          <div
            key={filter}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[7px] text-zinc-400"
          >
            <span>{filter}</span>
            <ChevronDown className="h-2.5 w-2.5" aria-hidden />
          </div>
        ))}
      </div>

      <div className="mt-3 px-4">
        <div className="grid grid-cols-[1.4fr_1fr_0.7fr_1fr_0.75fr] gap-2 border-b border-white/[0.06] pb-2 text-[7px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Merchant</span>
          <span>Payment Method</span>
          <span>Price</span>
          <span>Available / Limit</span>
          <span className="text-right">Trade</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {LAPTOP_OFFERS.map(({ merchant, rating, payment, price, available, limit }) => (
            <div
              key={merchant}
              className="grid grid-cols-[1.4fr_1fr_0.7fr_1fr_0.75fr] items-center gap-2 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/10 ring-1 ring-[#D4AF37]/25" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-[9px] font-semibold text-white">{merchant}</p>
                    <BadgeCheck className="h-2.5 w-2.5 shrink-0 text-emerald-400" aria-hidden />
                  </div>
                  <p className="text-[7px] text-zinc-500">{rating}</p>
                </div>
              </div>
              <p className="text-[8px] font-medium text-zinc-300">{payment}</p>
              <p className="text-[8px] font-semibold tabular-nums text-white">{price}</p>
              <div>
                <p className="text-[8px] tabular-nums text-zinc-200">{available}</p>
                <p className="text-[7px] tabular-nums text-zinc-500">{limit}</p>
              </div>
              <div className="flex justify-end">
                <span className="rounded-md bg-[#D4AF37] px-2 py-1 text-[7px] font-bold text-black">Buy USDT</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-center gap-6 border-t border-white/[0.06] px-4 py-3">
        {[
          { label: "Zero Fees", icon: ShieldCheck },
          { label: "Escrow Protected", icon: BadgeCheck },
          { label: "Verified Merchants", icon: Store },
        ].map(({ label, icon: FooterIcon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <FooterIcon className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            <span className="text-[8px] font-medium text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingHeroShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.05 }}
      className="relative mx-auto h-full min-h-[860px] w-full max-w-none"
    >
      {/* Shared ambient environment — transparent base, no pure black */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 35% 40%, rgba(15,35,70,0.35) 0%, rgba(8,15,28,0.18) 45%, transparent 75%)",
          }}
        />

        <div
          aria-hidden
          className="absolute bottom-[6%] left-1/2 z-[15] h-[720px] w-[920px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ backgroundColor: "rgba(212,175,55,0.10)" }}
        />

        <div
          aria-hidden
          className="absolute -right-28 -top-28 z-[15] h-[580px] w-[580px] rounded-full blur-[180px]"
          style={{ backgroundColor: "rgba(56,189,248,0.08)" }}
        />

        <WorldMapVisual className="absolute inset-0 h-full w-full opacity-[0.22]" showLogo />

        <div className="absolute inset-0 bg-gradient-to-t from-[#060B14]/35 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#05080F]/25" />
      </div>

      {/* Laptop mock — sits under phone (z-30) */}
      <div className="absolute left-[15%] top-[10%] z-30 hidden w-[78%] lg:block">
        <div className="overflow-hidden rounded-[22px] border border-[rgba(56,189,248,0.08)] bg-[rgba(8,15,28,0.52)] p-2 pt-2.5 shadow-[0_40px_120px_rgba(0,0,0,0.55),0_0_64px_rgba(56,189,248,0.06),inset_0_1px_0_rgba(56,189,248,0.1)] backdrop-blur-sm">
          <HeroLaptopDashboard />
        </div>
      </div>

      {/* Phone — in front of laptop */}
      <div className="absolute left-[-2%] top-[18%] z-40 w-full max-w-[300px]">
        <div className="rounded-[32px] border-[5px] border-zinc-600/70 bg-[rgba(12,20,36,0.85)] p-1.5 shadow-[0_40px_100px_rgba(0,0,0,0.59),0_0_48px_rgba(56,189,248,0.05)]">
          <div className="relative overflow-hidden rounded-[24px] bg-[rgba(8,15,28,0.88)]">
            <div
              className="absolute left-1/2 top-1.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[#060B14]"
              aria-hidden
            />
            <div className="relative aspect-[9/19.5] w-full">
              <HeroPhoneDashboard />
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-5 top-10 z-50 w-[220px] rounded-3xl border border-[#D4AF37]/35 bg-[rgba(8,15,28,0.72)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_55px_rgba(212,175,55,0.24)] backdrop-blur-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Market Overview</p>
        <div className="mt-2.5 space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between text-emerald-400">
            <span>BTC</span>
            <span>$68,315</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>ETH</span>
            <span>$3,510</span>
          </div>
          <div className="flex justify-between text-zinc-300">
            <span>USDT</span>
            <span>$1.00</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute right-6 top-[36%] z-50 hidden w-[220px] rounded-3xl border border-zinc-500/70 bg-[rgba(10,16,25,0.74)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_62px_rgba(212,175,55,0.24)] backdrop-blur-2xl md:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Portfolio</p>
        <p className="mt-1 text-xl font-black tabular-nums text-white">$207,500</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          +4.2% today
        </p>
      </motion.div>

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-12 left-[28%] z-50 rounded-3xl border border-zinc-700/80 bg-[rgba(10,16,25,0.78)] p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_55px_rgba(212,175,55,0.2)] backdrop-blur-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">Global network</p>
        <ul className="mt-2 space-y-1 text-zinc-200">
          <li className="font-semibold">2,400+ Active Traders</li>
          <li>380+ Verified Merchants</li>
          <li>38 Countries</li>
        </ul>
      </motion.div>

      <div className="absolute bottom-8 right-8 z-50 w-[220px] rounded-3xl border border-emerald-500/30 bg-[rgba(7,18,14,0.72)] p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.39),0_0_48px_rgba(16,185,129,0.14)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
          <span className="font-semibold text-emerald-300">Verified merchant</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-zinc-400">
          <Store className="h-3 w-3 text-[#D4AF37]" />
          P2P listings live
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-zinc-400">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          Escrow protected
        </p>
      </div>
    </motion.div>
  );
}
