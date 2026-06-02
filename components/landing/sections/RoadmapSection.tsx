"use client";

import { ROADMAP_PHASES } from "@/components/landing/landingData";

export function RoadmapSection() {
  return (
    <section id="roadmap" className="relative px-6 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">A Global Journey</p>
          <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
            Our Journey To A Global P2P Ecosystem
          </h2>
        </div>

        <div className="relative mt-14 hidden lg:block">
          <div className="absolute left-[16%] right-[16%] top-10 h-0.5 border-t border-dashed border-zinc-700" aria-hidden />
          <div className="grid grid-cols-3 gap-8">
            {ROADMAP_PHASES.map((item) => (
              <div key={item.phase} className="text-center">
                <div
                  className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 ${item.accent}`}
                >
                  <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">{item.phase}</p>
                <h3 className="mt-2 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-6 lg:hidden">
          {ROADMAP_PHASES.map((item) => (
            <div key={item.phase} className={`rounded-2xl border p-5 ${item.accent}`}>
              <p className="text-xs font-bold uppercase tracking-wider">{item.phase}</p>
              <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm opacity-90">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
