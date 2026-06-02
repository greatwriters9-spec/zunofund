import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Star, TrendingUp, UserCheck } from "lucide-react";

const REQUIREMENTS = [
  "Maintain consistent investment activity on your account",
  "Build a trusted account history with responsible transactions",
  "Increase portfolio participation to unlock higher eligibility tiers",
  "Follow platform security and verification standards",
] as const;

const BENEFITS = [
  "Publish buy/sell offers in the Zuno P2P marketplace",
  "Access merchant console tools and advanced trade controls",
  "Gain visibility as a verified merchant to global traders",
] as const;

export default function MerchantRequirementsPage() {
  return (
    <main className="min-h-screen bg-[#05080F] text-white">
      <section className="relative overflow-hidden px-6 pb-16 pt-20 lg:px-10 lg:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(212,175,55,0.14),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(245,230,179,0.08),transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F5E6B3]">
              <UserCheck className="h-4 w-4 text-[#D4AF37]" />
              Merchant Requirements
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/auth"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-[#D4AF37]/45"
              >
                Sign In
              </Link>
              <Link
                href="/auth?signup=1"
                className="rounded-lg bg-[#D4AF37] px-3 py-2 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
              >
                Create Account
              </Link>
            </div>
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-5xl lg:text-6xl">
            Unlock <span className="text-[#D4AF37]">Verified Merchant</span> Access
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 md:text-lg">
            Keep investing, stay active, and grow your account to unlock merchant level. Zuno promotes trusted
            participants into the verified merchant program based on consistent platform engagement.
          </p>
        </div>
      </section>

      <section className="px-6 pb-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-950/85 p-7 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-4 inline-flex rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-2.5">
              <TrendingUp className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-black text-white">How to unlock merchant level</h2>
            <ul className="mt-5 space-y-3 text-sm text-zinc-300">
              {REQUIREMENTS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-3xl border border-zinc-800 bg-zinc-950/85 p-7 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <div className="mb-4 inline-flex rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white">Merchant benefits</h2>
            <ul className="mt-5 space-y-3 text-sm text-zinc-300">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/8 p-4 text-sm text-[#F5E6B3]">
              Keep growing your account and check your progress from the rewards and dashboard experience.
            </div>
          </article>
        </div>
      </section>

      <section className="px-6 pb-20 lg:px-10">
        <div className="mx-auto max-w-7xl rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 text-center md:p-9">
          <h2 className="text-2xl font-black text-white md:text-3xl">Start your merchant unlock journey</h2>
          <p className="mt-3 text-sm text-zinc-400 md:text-base">
            Continue investing and participating in Zuno to become eligible for verified merchant access.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/investment-plans"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#D4AF37]/45"
            >
              Explore Plans
            </Link>
            <Link
              href="/auth?signup=1"
              className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#E5BD45]"
            >
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
