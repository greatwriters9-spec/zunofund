/** Merchant console surfaces — aligned with investor dashboard premium tokens. */
export {
  DASHBOARD_BG as MERCHANT_BG,
  DASHBOARD_CARD as MERCHANT_CARD,
  DASHBOARD_MUTED as MERCHANT_MUTED,
  DASHBOARD_GOLD as MERCHANT_GOLD,
  DASHBOARD_SUCCESS as MERCHANT_SUCCESS,
  DASHBOARD_SURFACE as MERCHANT_SURFACE,
} from "@/components/dashboard/premium/dashboardStyles";

export const MERCHANT_SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90";

export const MERCHANT_HERO_GRADIENT =
  "pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(212,175,55,0.08)_0%,transparent_70%)]";

export const MERCHANT_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#F7E3A0] via-[#D4AF37] to-[#EAC54F] px-5 py-2.5 text-xs font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";

export const MERCHANT_GHOST_BTN =
  "inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-[#D4AF37]/35 hover:text-[#F5E6B3]";
