"use client";

import { HOW_IT_WORKS_STEPS } from "@/components/landing/landingData";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative bg-white px-6 py-20 text-zinc-900 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">How It Works</p>
          <h2 className="mt-3 text-3xl font-black md:text-4xl">A Simple Path To Global P2P Finance</h2>
        </div>

        <div className="relative mt-14 hidden lg:block">
          <div className="absolute left-[12%] right-[12%] top-8 h-0.5 border-t border-dashed border-zinc-300" aria-hidden />
          <div className="grid grid-cols-4 gap-6">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#D4AF37] bg-white text-xl font-black text-[#D4AF37] shadow-md">
                  {step.step}
                </div>
                <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-8 lg:hidden">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div key={step.step} className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#D4AF37] text-lg font-black text-[#D4AF37]">
                {step.step}
              </div>
              <div>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
