"use client";

import {
  tradeBannerMessage,
  type TradeBannerCopyInput,
} from "@/components/p2p/tradeSummaryUi";

type TradeOrderBriefProps = TradeBannerCopyInput & {
  payLabel: string;
  receiveLabel: string;
  paymentMethod: string;
};

export function TradeOrderBrief(props: TradeOrderBriefProps) {
  const message = tradeBannerMessage(props);

  return (
    <div className="shrink-0 border-b border-[#00C076]/15 px-2.5 py-2 sm:px-4 sm:py-3">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-600 px-3 py-2.5 text-[13px] font-medium leading-snug text-white break-words sm:px-4 sm:py-3 sm:text-[15px] sm:leading-relaxed">
        {message}
      </div>
    </div>
  );
}
