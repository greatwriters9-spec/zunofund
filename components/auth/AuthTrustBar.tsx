const TRUST_ITEMS = [
  {
    title: "Secure & Protected",
    text: "Your assets are safe with institutional-grade security.",
  },
  {
    title: "Transparent & Trusted",
    text: "Clear processes and real-time performance tracking.",
  },
  {
    title: "Investor Focused",
    text: "Built for long-term growth and financial freedom.",
  },
] as const;

export function AuthTrustBar() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-8 py-8 sm:grid-cols-3 sm:gap-6">
        {TRUST_ITEMS.map(({ title, text }) => (
          <div key={title} className="text-center sm:text-left">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{text}</p>
          </div>
        ))}
      </div>
    </footer>
  );
}
