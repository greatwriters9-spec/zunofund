import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";

import { MarketingNavbar } from "@/components/navbar";
import { ANDROID_APP_DOWNLOAD } from "@/lib/mobileApp";

export const metadata: Metadata = {
  title: "Download App",
  description:
    "Download the Zuno Android app for secure access to your dashboard, deposits, referrals, and P2P trading.",
};

const INSTALL_STEPS = [
  "Download the APK using the button below.",
  "Open the file when prompted (or find it in your Downloads folder).",
  "If Android asks, allow install from this source / unknown apps for your browser.",
  "Open Zuno, sign in, and use the app like the website.",
] as const;

export default function DownloadAppPage() {
  return (
    <main className="min-h-screen text-white">
      <MarketingNavbar />

      <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 md:pt-16">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#F5E6B3]">
          <Smartphone size={14} aria-hidden />
          Android app
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Download Zuno for Android
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          Install the official Zuno app for fast, secure access to your portfolio,
          deposits, withdrawals, referrals, and P2P — powered by the same platform
          at{" "}
          <span className="text-zinc-300">www.zunofund.com</span>.
        </p>

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Current build</p>
              <p className="mt-1 text-lg font-semibold text-white">
                Zuno Android v{ANDROID_APP_DOWNLOAD.version}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Package: {ANDROID_APP_DOWNLOAD.packageId}
              </p>
            </div>

            <a
              href={ANDROID_APP_DOWNLOAD.href}
              download={ANDROID_APP_DOWNLOAD.fileName}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3.5 text-sm font-bold text-black transition hover:bg-[#E5BD45] hover:shadow-[0_0_22px_rgba(212,175,55,0.4)]"
            >
              <ArrowDownToLine size={18} aria-hidden />
              Download APK
            </a>
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/80" aria-hidden />
            Google Play listing is coming soon. This direct download is for early access
            and testing while we complete store review.
          </p>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Install steps</h2>
          <ol className="mt-4 space-y-3">
            {INSTALL_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm text-zinc-300"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-xs font-bold text-[#D4AF37]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/auth?signup=1"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#D4AF37]/40"
          >
            Create account
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-zinc-400 transition hover:text-[#D4AF37]"
          >
            Need help installing?
          </Link>
        </div>
      </div>
    </main>
  );
}
