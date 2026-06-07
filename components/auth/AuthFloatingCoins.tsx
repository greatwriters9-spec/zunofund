"use client";

import { motion } from "framer-motion";
import { SiBitcoin, SiEthereum, SiLitecoin, SiTether } from "react-icons/si";

const COINS = [
  { Icon: SiBitcoin, color: "#F7931A", className: "left-[8%] top-[18%] h-16 w-16", delay: 0 },
  { Icon: SiEthereum, color: "#627EEA", className: "right-[12%] top-[8%] h-14 w-14", delay: 1.2 },
  { Icon: SiTether, color: "#26A17B", className: "left-[18%] bottom-[28%] h-12 w-12", delay: 2.4 },
  { Icon: SiLitecoin, color: "#B8C2CC", className: "right-[6%] bottom-[22%] h-20 w-20", delay: 0.8 },
] as const;

export function AuthFloatingCoins() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {COINS.map(({ Icon, color, className, delay }) => (
        <motion.div
          key={color}
          className={`absolute ${className}`}
          animate={{ y: [0, -10, 4, -8, 0], rotate: [0, 3, -2, 2, 0] }}
          transition={{
            duration: 10,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div
            className="absolute inset-0 rounded-full opacity-40 blur-xl"
            style={{ backgroundColor: color }}
          />
          <div className="relative flex h-full w-full items-center justify-center rounded-full border border-[#D4AF37]/25 bg-gradient-to-br from-[#FFF4C2]/90 via-[#F5E6B3]/80 to-[#D4AF37]/70 shadow-[0_8px_32px_rgba(212,175,55,0.25)]">
            <Icon className="h-[42%] w-[42%]" style={{ color }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
