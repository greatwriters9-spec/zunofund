"use client";

import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";

export function DownloadAppSection() {
  return (
    <section className="bg-white px-6 py-20 text-zinc-900 lg:px-10 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Trade Anytime</p>
          <h2 className="mt-3 text-3xl font-black md:text-4xl">Download The Zuno App</h2>
          <p className="mt-4 text-zinc-600">
            Trade, invest, and monitor your portfolio from anywhere with secure real-time access.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <Download size={16} />
              Google Play
            </Link>
            <a
              href="/downloads/zuno-android.apk"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              <Download size={16} />
              Android APK
            </a>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <div className="relative w-[140px] shrink-0 overflow-hidden rounded-[28px] border-4 border-zinc-900 bg-zinc-900 shadow-xl sm:w-[160px]">
            <div className="relative aspect-[9/19] w-full">
              <Image
                src="/landing/hero-phone-dashboard.png"
                alt="Zuno dashboard mobile preview"
                fill
                className="object-cover object-top"
                sizes="160px"
              />
            </div>
          </div>
          <div className="relative mt-8 hidden w-[140px] shrink-0 overflow-hidden rounded-[28px] border-4 border-zinc-900 bg-zinc-900 shadow-xl sm:block sm:w-[160px]">
            <div className="relative aspect-[9/19] w-full">
              <Image
                src="/landing/hero-phone-p2p.png"
                alt="Zuno P2P mobile preview"
                fill
                className="object-cover object-top"
                sizes="160px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
