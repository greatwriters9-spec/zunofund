import Image from "next/image";
import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "P2P Marketplace", href: "/#home" },
      { label: "Investment Plans", href: "/investment-plans" },
      { label: "Markets", href: "/markets" },
      { label: "Rewards", href: "/rewards" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Merchant Program", href: "/merchant" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/support" },
      { label: "Contact", href: "/contact" },
      { label: "Download App", href: "/download" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Telegram", href: "/contact" },
      { label: "Create Account", href: "/auth?signup=1" },
      { label: "Login", href: "/auth" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-[#05080F] px-6 py-16 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/logo.png" alt="Zuno" width={36} height={36} className="h-9 w-auto" />
              <span className="text-sm font-semibold tracking-[0.2em] text-white">ZUNO</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              A global P2P marketplace connecting traders, investors, and verified merchants through one secure
              ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{col.title}</p>
                <ul className="mt-4 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm text-zinc-500 transition hover:text-[#D4AF37]">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-900 pt-8">
          <p className="text-xs leading-relaxed text-zinc-600">
            Risk Disclaimer: Investment and trading activities involve risk. Market conditions may impact portfolio
            performance. Past performance does not guarantee future results. Investors are advised to understand market
            risks and invest responsibly.
          </p>
          <p className="mt-6 text-sm text-zinc-600">© {new Date().getFullYear()} Zuno. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
