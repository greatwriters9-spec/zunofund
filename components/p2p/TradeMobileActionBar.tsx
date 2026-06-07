"use client";

type TradeMobileActionBarProps = {
  primaryLabel: string | null;
  primaryBusy?: boolean;
  primaryDisabled?: boolean;
  primaryVariant?: "primary" | "release" | "dispute";
  onPrimary?: () => void;
  showCancel?: boolean;
  cancelDisabled?: boolean;
  onCancel?: () => void;
};

export function TradeMobileActionBar({
  primaryLabel,
  primaryBusy,
  primaryDisabled,
  primaryVariant = "primary",
  onPrimary,
  showCancel,
  cancelDisabled,
  onCancel,
}: TradeMobileActionBarProps) {
  if (!primaryLabel && !showCancel) return null;

  const primaryCls =
    primaryVariant === "release"
      ? "bg-red-600 text-white shadow-[0_4px_16px_rgba(220,38,38,0.28)] active:bg-red-500"
      : primaryVariant === "dispute"
        ? "border border-amber-500/50 bg-amber-500/20 text-amber-50 shadow-[0_4px_16px_rgba(245,158,11,0.15)] active:bg-amber-500/30"
        : "bg-[#00C076] text-white shadow-[0_4px_20px_rgba(0,192,118,0.28)] active:bg-[#00D684]";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 px-4 lg:hidden"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg gap-3 rounded-2xl border border-white/[0.1] bg-[rgba(10,14,22,0.9)] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl">
        {primaryLabel ? (
          <button
            type="button"
            disabled={primaryDisabled || primaryBusy}
            onClick={onPrimary}
            className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${primaryCls}`}
          >
            {primaryBusy ? "Please wait…" : primaryLabel}
          </button>
        ) : null}
        {showCancel ? (
          <button
            type="button"
            disabled={cancelDisabled}
            onClick={onCancel}
            className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-red-500/45 bg-red-500/[0.1] px-3 text-[13px] font-semibold text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 ${
              primaryLabel ? "" : "w-full"
            }`}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
