"use client";

import { motion } from "framer-motion";
import { useId } from "react";

import { GoldRewardParticles } from "@/components/landing/GoldRewardParticles";

export function GrowthChart() {
  const bars = [28, 42, 55, 68, 82, 100];
  const uid = useId().replace(/:/g, "");
  const barFillId = `growth-bar-fill-${uid}`;
  const arrowStrokeId = `growth-arrow-stroke-${uid}`;

  return (
    <div className="relative h-36 w-full max-w-[220px]">
      <motion.div
        className="pointer-events-none absolute right-2 top-6 h-20 w-28 rounded-full bg-[#D4AF37]/35 blur-2xl"
        aria-hidden
        animate={{ opacity: [0.22, 0.48, 0.28, 0.42, 0.22], scale: [0.95, 1.08, 1, 1.06, 0.95] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <GoldRewardParticles count={7} seed={40} className="absolute inset-0 overflow-visible" />
      <svg viewBox="0 0 220 140" className="relative h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={barFillId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#B8860B" />
            <stop offset="100%" stopColor="#F5E6B3" />
          </linearGradient>
          <linearGradient id={arrowStrokeId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#FFF4C2" />
          </linearGradient>
        </defs>
        {bars.map((height, index) => {
          const barWidth = 22;
          const gap = 10;
          const x = 12 + index * (barWidth + gap);
          const barHeight = (height / 100) * 72;
          const y = 108 - barHeight;
          return (
            <g key={`${height}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={`url(#${barFillId})`}
                opacity={0.85 + index * 0.03}
              />
              <motion.circle
                cx={x + barWidth / 2}
                cy={y}
                r={2.2}
                fill="#FFF8DC"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.35, 0.9, 0] }}
                transition={{
                  duration: 5 + index * 0.7,
                  delay: index * 0.9,
                  repeat: Infinity,
                  repeatDelay: 3 + index * 0.5,
                  ease: "easeInOut",
                }}
              />
            </g>
          );
        })}
        <path
          d="M18 98 C52 88, 78 72, 108 58 S168 28, 198 18"
          fill="none"
          stroke={`url(#${arrowStrokeId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polygon points="198,18 188,22 192,30" fill="#F5E6B3" />
        <motion.circle
          cx={198}
          cy={18}
          r={3}
          fill="#FFF8DC"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.25, 1, 0.4, 0.85, 0.25] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}
