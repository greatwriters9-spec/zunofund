"use client";

import { useEffect, useRef, useState } from "react";

export type ChartInterval = "1" | "5" | "15" | "60" | "240" | "D" | "W";

export const CHART_INTERVAL_OPTIONS: { value: ChartInterval; label: string }[] = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "D", label: "1D" },
  { value: "W", label: "1W" },
];

type TradingViewChartProps = {
  symbol: string;
  interval: ChartInterval;
};

declare global {
  interface Window {
    TradingView?: {
      widget: (opts: Record<string, unknown>) => void;
    };
  }
}

function tradingViewSymbol(binanceSymbol: string): string {
  return `BINANCE:${binanceSymbol.toUpperCase()}`;
}

export function TradingViewChart({ symbol, interval }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.TradingView?.widget) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector('script[data-zuno-tv="1"]');
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.dataset.zunoTv = "1";
    script.onload = () => setScriptReady(true);
    script.onerror = () => setScriptReady(false);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.TradingView?.widget) return;

    containerRef.current.innerHTML = "";
    const id = `tv_${symbol}_${interval}`;
    const inner = document.createElement("div");
    inner.id = id;
    inner.style.height = "100%";
    inner.style.width = "100%";
    containerRef.current.appendChild(inner);

    window.TradingView.widget({
      autosize: true,
      symbol: tradingViewSymbol(symbol),
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      container_id: id,
      backgroundColor: "#05080F",
      gridColor: "rgba(255,255,255,0.06)",
    });
  }, [scriptReady, symbol, interval]);

  return (
    <div
      ref={containerRef}
      className="h-[min(420px,55vh)] w-full min-h-[280px] rounded-xl border border-zinc-800/80 bg-[#05080F]"
    />
  );
}
