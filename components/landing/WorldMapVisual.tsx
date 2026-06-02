"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const MAP_NODES = [
  { id: "nyc", x: 18, y: 35, city: "New York" },
  { id: "bos", x: 21, y: 32, city: "Boston" },
  { id: "mia", x: 22, y: 46, city: "Miami" },
  { id: "tor", x: 20, y: 30, city: "Toronto" },
  { id: "mex", x: 16, y: 52, city: "Mexico City" },
  { id: "bog", x: 22, y: 60, city: "Bogota" },
  { id: "sao", x: 30, y: 74, city: "Sao Paulo" },
  { id: "bue", x: 28, y: 84, city: "Buenos Aires" },
  { id: "lon", x: 43, y: 29, city: "London" },
  { id: "par", x: 45, y: 31, city: "Paris" },
  { id: "ams", x: 45, y: 27, city: "Amsterdam" },
  { id: "mad", x: 42, y: 36, city: "Madrid" },
  { id: "ber", x: 47, y: 29, city: "Berlin" },
  { id: "rom", x: 48, y: 36, city: "Rome" },
  { id: "ist", x: 52, y: 36, city: "Istanbul" },
  { id: "cai", x: 52, y: 44, city: "Cairo" },
  { id: "lag", x: 46, y: 58, city: "Lagos" },
  { id: "acc", x: 44, y: 61, city: "Accra" },
  { id: "nbo", x: 54, y: 62, city: "Nairobi" },
  { id: "cpt", x: 50, y: 84, city: "Cape Town" },
  { id: "dxb", x: 57, y: 41, city: "Dubai" },
  { id: "ruh", x: 55, y: 44, city: "Riyadh" },
  { id: "del", x: 64, y: 43, city: "Delhi" },
  { id: "mum", x: 62, y: 48, city: "Mumbai" },
  { id: "blr", x: 64, y: 54, city: "Bangalore" },
  { id: "kar", x: 60, y: 44, city: "Karachi" },
  { id: "sin", x: 73, y: 57, city: "Singapore" },
  { id: "kul", x: 72, y: 60, city: "Kuala Lumpur" },
  { id: "bkk", x: 72, y: 53, city: "Bangkok" },
  { id: "hkg", x: 78, y: 47, city: "Hong Kong" },
  { id: "tpe", x: 80, y: 45, city: "Taipei" },
  { id: "sha", x: 79, y: 41, city: "Shanghai" },
  { id: "pek", x: 78, y: 36, city: "Beijing" },
  { id: "sel", x: 83, y: 35, city: "Seoul" },
  { id: "tyo", x: 86, y: 38, city: "Tokyo" },
  { id: "osa", x: 85, y: 42, city: "Osaka" },
  { id: "man", x: 80, y: 53, city: "Manila" },
  { id: "jkt", x: 76, y: 64, city: "Jakarta" },
  { id: "syd", x: 88, y: 78, city: "Sydney" },
  { id: "mel", x: 86, y: 83, city: "Melbourne" },
  { id: "per", x: 78, y: 80, city: "Perth" },
  { id: "akl", x: 93, y: 87, city: "Auckland" },
  { id: "mow", x: 58, y: 27, city: "Moscow" },
  { id: "hel", x: 52, y: 21, city: "Helsinki" },
  { id: "sto", x: 49, y: 19, city: "Stockholm" },
  { id: "waw", x: 50, y: 28, city: "Warsaw" },
  { id: "vln", x: 63, y: 34, city: "Almaty" },
  { id: "kbl", x: 61, y: 39, city: "Kabul" },
  { id: "dkr", x: 39, y: 57, city: "Dakar" },
  { id: "add", x: 56, y: 58, city: "Addis Ababa" },
  { id: "cas", x: 39, y: 41, city: "Casablanca" },
  { id: "ath", x: 49, y: 34, city: "Athens" },
  { id: "lis", x: 39, y: 35, city: "Lisbon" },
  { id: "chi", x: 16, y: 39, city: "Chicago" },
  { id: "la", x: 10, y: 42, city: "Los Angeles" },
  { id: "doh", x: 58, y: 43, city: "Doha" },
  { id: "jhb", x: 52, y: 77, city: "Johannesburg" },
  { id: "han", x: 75, y: 49, city: "Hanoi" },
  { id: "fra", x: 46, y: 27, city: "Frankfurt" },
] as const;

const CONNECTIONS: [string, string][] = [
  ["nyc", "lon"],
  ["nyc", "mia"],
  ["nyc", "tor"],
  ["tor", "lon"],
  ["mia", "bog"],
  ["bog", "sao"],
  ["sao", "bue"],
  ["lon", "par"],
  ["lon", "ams"],
  ["lon", "ber"],
  ["par", "rom"],
  ["mad", "lis"],
  ["ber", "waw"],
  ["rom", "ath"],
  ["ist", "dxb"],
  ["cai", "lag"],
  ["lag", "nbo"],
  ["nbo", "add"],
  ["lag", "dkr"],
  ["dxb", "mum"],
  ["dxb", "del"],
  ["mum", "sin"],
  ["del", "hkg"],
  ["mum", "kar"],
  ["sin", "hkg"],
  ["sin", "jkt"],
  ["hkg", "sha"],
  ["sha", "pek"],
  ["pek", "sel"],
  ["sel", "tyo"],
  ["tyo", "syd"],
  ["syd", "akl"],
  ["jkt", "per"],
  ["per", "mel"],
  ["mel", "akl"],
  ["mow", "dxb"],
  ["mow", "hel"],
  ["hel", "sto"],
  ["sto", "lon"],
  ["vln", "pek"],
  ["kbl", "del"],
  ["cas", "mad"],
  ["acc", "lag"],
  ["nbo", "dxb"],
  ["la", "nyc"],
  ["chi", "lon"],
  ["fra", "dxb"],
  ["doh", "sin"],
  ["jhb", "lag"],
  ["han", "hkg"],
  ["han", "sin"],
  ["jhb", "nbo"],
];

function nodeById(id: string) {
  return MAP_NODES.find((n) => n.id === id)!;
}

type WorldMapVisualProps = {
  className?: string;
  showLogo?: boolean;
};

export function WorldMapVisual({ className = "", showLogo = false }: WorldMapVisualProps) {
  const uid = useId().replace(/:/g, "");
  const nodeGlowId = `landingNodeGlow-${uid}`;
  const linkGradId = `landingLinkGrad-${uid}`;
  const routePulseId = `landingRoutePulse-${uid}`;

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(245,230,179,0.12),transparent_50%),radial-gradient(circle_at_52%_56%,rgba(212,175,55,0.14),transparent_52%)]" />

      <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={nodeGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F5E6B3" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id={linkGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#F5E6B3" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id={routePulseId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5E6B3" stopOpacity="0" />
            <stop offset="50%" stopColor="#F5E6B3" stopOpacity="1" />
            <stop offset="100%" stopColor="#F5E6B3" stopOpacity="0" />
          </linearGradient>
        </defs>

        {CONNECTIONS.map(([from, to], i) => {
          const a = nodeById(from);
          const b = nodeById(to);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 8;
          return (
            <motion.path
              key={`${from}-${to}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={`url(#${linkGradId})`}
              strokeWidth="0.4"
              initial={{ pathLength: 0, opacity: 0.24 }}
              whileInView={{ pathLength: 1, opacity: [0.25, 0.85, 0.25] }}
              viewport={{ once: true }}
              transition={{
                pathLength: { duration: 2.2, delay: i * 0.04 },
                opacity: { duration: 4, repeat: Infinity, delay: i * 0.08 },
              }}
            />
          );
        })}
        {CONNECTIONS.map(([from, to], i) => {
          const a = nodeById(from);
          const b = nodeById(to);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 8;
          return (
            <motion.path
              key={`pulse-${from}-${to}`}
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={`url(#${routePulseId})`}
              strokeWidth="0.7"
              strokeLinecap="round"
              initial={{ pathLength: 0.2, pathOffset: 1, opacity: 0 }}
              animate={{ pathOffset: [1, 0], opacity: [0, 0.95, 0] }}
              transition={{ duration: 3.6, repeat: Infinity, delay: i * 0.09, ease: "linear" }}
            />
          );
        })}

        {MAP_NODES.map((node, i) => (
          <g key={node.id}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r="1.55"
              fill={`url(#${nodeGlowId})`}
              animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.18, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.07 }}
            />
          </g>
        ))}
      </svg>

      {showLogo ? (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-black/60 shadow-[0_0_40px_rgba(212,175,55,0.35)]">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-auto object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
