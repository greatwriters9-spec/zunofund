"use client";

const TOC_ITEMS = [
  { label: "Agreement & Acceptance", id: "agreement-acceptance" },
  { label: "Investment Risk Disclosure", id: "investment-risk-disclosure" },
  { label: "User Responsibilities", id: "user-responsibilities" },
  { label: "Deposits & Withdrawals", id: "deposits-withdrawals" },
  { label: "Privacy", id: "privacy" },
  { label: "Termination", id: "termination" },
] as const;

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TermsTableOfContents() {
  return (
    <nav
      aria-label="Terms table of contents"
      className="sticky top-0 z-10 -mx-1 mb-6 border-b border-zinc-100 bg-white px-1 pb-4 pt-1"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C9A227]">
        On this page
      </p>
      <ul className="flex flex-wrap gap-2">
        {TOC_ITEMS.map(({ label, id }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => scrollToSection(id)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 hover:text-zinc-900"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
