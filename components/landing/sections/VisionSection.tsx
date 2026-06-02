"use client";

import { VISION_STATS } from "@/components/landing/landingData";
import { WorldMapVisual } from "@/components/landing/WorldMapVisual";

export function VisionSection() {
  return (
    <section id="about" className="relative px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="mx-auto max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">
            We&apos;re Building The World&apos;s
            <span className="text-[#D4AF37]"> Largest P2P Trading Network</span>
          </h2>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[32px] border border-zinc-800 bg-[#070b12]">
          <WorldMapVisual className="h-[280px] sm:h-[340px] lg:h-[400px]" showLogo />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05080F] via-transparent to-transparent" />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {VISION_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-5 py-6 text-center backdrop-blur-sm"
            >
              <p className="text-2xl font-black text-[#D4AF37] md:text-3xl">{stat.value}</p>
              <p className="mt-2 text-sm text-zinc-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
