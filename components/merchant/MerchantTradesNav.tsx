"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/merchant/orders/active", label: "Active trades" },
  { href: "/merchant/orders/completed", label: "Completed trades" },
];

export function MerchantTradesNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
      {LINKS.map(({ href, label }) => {
        const on = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={
              "rounded-xl px-4 py-2 text-sm font-semibold transition " +
              (on
                ? "bg-yellow-500 text-black"
                : "border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-yellow-500/40 hover:text-white")
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
