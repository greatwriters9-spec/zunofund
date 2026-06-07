"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

type ParticleKind = "dust" | "sparkle" | "ember" | "fragment";

type ParticleSpec = {
  id: number;
  kind: ParticleKind;
  left: number;
  top: number;
  size: number;
  rotate: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  peakOpacity: number;
};

function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Stable precision for SSR/client style parity */
function roundStyle(n: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function buildParticles(count: number, seedOffset: number): ParticleSpec[] {
  const kinds: ParticleKind[] = ["dust", "sparkle", "sparkle", "ember", "fragment", "sparkle"];

  return Array.from({ length: count }, (_, index) => {
    const seed = seedOffset + index + 1;
    const kind = kinds[Math.floor(seeded(seed) * kinds.length)]!;

    const size =
      kind === "dust"
        ? 1.5 + seeded(seed + 3) * 2
        : kind === "sparkle"
          ? 2.5 + seeded(seed + 3) * 2.5
          : kind === "ember"
            ? 3 + seeded(seed + 3) * 2.5
            : 2 + seeded(seed + 3) * 2.5;

    return {
      id: seedOffset + index,
      kind,
      left: roundStyle(seeded(seed + 1) * 100),
      top: roundStyle(seeded(seed + 2) * 100),
      size: roundStyle(size, 3),
      rotate: roundStyle(seeded(seed + 4) * 360, 2),
      duration: roundStyle(4 + seeded(seed + 5) * 8, 3),
      delay: roundStyle(seeded(seed + 6) * 6, 3),
      driftX: roundStyle((seeded(seed + 7) - 0.5) * 18, 3),
      driftY: roundStyle(-6 - seeded(seed + 8) * 14, 3),
      peakOpacity: roundStyle(
        kind === "ember"
          ? 0.45 + seeded(seed + 9) * 0.3
          : kind === "sparkle"
            ? 0.55 + seeded(seed + 9) * 0.35
            : kind === "fragment"
              ? 0.4 + seeded(seed + 9) * 0.28
              : 0.32 + seeded(seed + 9) * 0.28,
        4,
      ),
    };
  });
}

function ParticleNode({ particle }: { particle: ParticleSpec }) {
  const { kind, size, rotate, duration, delay, driftX, driftY, peakOpacity, left, top } =
    particle;

  const baseClass =
    "pointer-events-none absolute will-change-[transform,opacity]";

  const motionProps = {
    initial: { opacity: 0, x: 0, y: 0, scale: 0.6 },
    animate: {
      opacity: [0, peakOpacity, peakOpacity * 0.72, peakOpacity * 0.95, 0],
      x: [0, driftX * 0.35, driftX * 0.65, driftX],
      y: [0, driftY * 0.4, driftY * 0.75, driftY],
      scale:
        kind === "sparkle"
          ? [0.6, 1.15, 0.95, 1.1, 0.6]
          : kind === "ember"
            ? [0.75, 1.1, 0.95, 1.05, 0.75]
            : [0.8, 1.08, 0.95, 1.05, 0.8],
    },
    transition: {
      duration,
      delay,
      repeat: Infinity,
      repeatDelay: 1.5 + (particle.id % 4),
      ease: "easeInOut" as const,
    },
    style: { left: `${left.toFixed(4)}%`, top: `${top.toFixed(4)}%` },
  };

  if (kind === "sparkle") {
    return (
      <motion.span
        className={baseClass}
        {...motionProps}
        style={{
          ...motionProps.style,
          width: size,
          height: size,
          rotate: `${rotate.toFixed(2)}deg`,
        }}
      >
        <span className="block h-full w-full rotate-45 rounded-[1px] bg-gradient-to-br from-white via-[#FFF4C2] to-[#D4AF37] shadow-[0_0_10px_rgba(255,244,194,0.85),0_0_18px_rgba(212,175,55,0.55)]" />
      </motion.span>
    );
  }

  if (kind === "fragment") {
    return (
      <motion.span
        className={`${baseClass} rounded-[1px] bg-gradient-to-br from-white via-[#FFF4C2] to-[#B8860B] shadow-[0_0_8px_rgba(212,175,55,0.5)]`}
        {...motionProps}
        style={{
          ...motionProps.style,
          width: size * 0.6,
          height: size * 1.6,
          rotate: `${rotate.toFixed(2)}deg`,
        }}
      />
    );
  }

  if (kind === "ember") {
    return (
      <motion.span
        className={`${baseClass} rounded-full bg-gradient-to-br from-[#FFF8DC] via-[#F5E6B3] to-[#D4AF37]`}
        {...motionProps}
        style={{
          ...motionProps.style,
          width: size,
          height: size,
          boxShadow: `0 0 ${roundStyle(size * 2.5, 2)}px rgba(255,244,194,0.75), 0 0 ${roundStyle(size * 4, 2)}px rgba(212,175,55,0.45)`,
        }}
      />
    );
  }

  return (
    <motion.span
      className={`${baseClass} rounded-full bg-gradient-to-br from-[#FFF4C2] to-[#D4AF37]`}
      {...motionProps}
      style={{
        ...motionProps.style,
        width: size,
        height: size,
        boxShadow: `0 0 ${roundStyle(size * 3, 2)}px rgba(255,244,194,0.65), 0 0 ${roundStyle(size * 5, 2)}px rgba(212,175,55,0.35)`,
      }}
    />
  );
}

type GoldRewardParticlesProps = {
  count?: number;
  seed?: number;
  className?: string;
};

export function GoldRewardParticles({
  count = 12,
  seed = 0,
  className = "absolute inset-0 overflow-hidden",
}: GoldRewardParticlesProps) {
  const particles = useMemo(() => buildParticles(count, seed), [count, seed]);

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden>
      {particles.map((particle) => (
        <ParticleNode key={particle.id} particle={particle} />
      ))}
    </div>
  );
}

export function GoldShimmerSweep({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0] }}
      transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#FFF4C2]/28 to-transparent"
        animate={{ x: ["0%", "420%"] }}
        transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
