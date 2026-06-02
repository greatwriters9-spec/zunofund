"use client";

import type { CSSProperties } from "react";

/** Fixed layout — stable across SSR and no hydration flicker. */
const PARTICLES = [
  { left: "8%", top: "14%", size: 3, opacity: 0.2, duration: 24, delay: 0, dx: 14, dy: -10 },
  { left: "22%", top: "28%", size: 2, opacity: 0.15, duration: 28, delay: 2, dx: -10, dy: 8 },
  { left: "38%", top: "12%", size: 4, opacity: 0.28, duration: 20, delay: 4, dx: 12, dy: 12 },
  { left: "52%", top: "22%", size: 3, opacity: 0.22, duration: 26, delay: 1, dx: -14, dy: -8 },
  { left: "68%", top: "10%", size: 5, opacity: 0.32, duration: 22, delay: 6, dx: 10, dy: -14 },
  { left: "84%", top: "18%", size: 2, opacity: 0.18, duration: 30, delay: 3, dx: -8, dy: 10 },
  { left: "14%", top: "48%", size: 4, opacity: 0.25, duration: 18, delay: 5, dx: 16, dy: 6 },
  { left: "31%", top: "62%", size: 3, opacity: 0.19, duration: 27, delay: 7, dx: -12, dy: -12 },
  { left: "47%", top: "54%", size: 2, opacity: 0.35, duration: 25, delay: 0.5, dx: 8, dy: 14 },
  { left: "61%", top: "68%", size: 4, opacity: 0.21, duration: 29, delay: 8, dx: -16, dy: 8 },
  { left: "76%", top: "44%", size: 3, opacity: 0.38, duration: 21, delay: 2.5, dx: 11, dy: -9 },
  { left: "91%", top: "58%", size: 2, opacity: 0.16, duration: 23, delay: 4.5, dx: -9, dy: -11 },
] as const;

export function HeroGoldParticles() {
  return (
    <div aria-hidden className="hero-gold-particles pointer-events-none absolute inset-0 z-[6] overflow-hidden">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="hero-gold-particle absolute rounded-full bg-[#D4AF37]"
          style={
            {
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
