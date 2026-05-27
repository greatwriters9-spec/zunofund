"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { formatUsdAmount } from "@/lib/formatMoney";

function useLiteChartRendering() {
  const [lite, setLite] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px), (hover: none) and (pointer: coarse)");
    const sync = () => setLite(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return lite;
}

export interface ProfitChartDatum {
  id: number;
  date: string;
  profit: number;
}

function MobileProfitSummary(props: { data: ProfitChartDatum[] }) {
  const total = props.data.reduce((sum, row) => sum + row.profit, 0);
  const latest = props.data[props.data.length - 1];

  return (
    <div className="flex min-h-[200px] flex-col justify-center rounded-lg border border-zinc-800/80 bg-zinc-950 px-4 py-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Cumulative profit
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-yellow-500">
        {formatUsdAmount(total)}
      </p>
      {latest ? (
        <p className="mt-2 text-xs text-zinc-500">
          Latest ({latest.date}): {formatUsdAmount(latest.profit)}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">No profit history yet.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
        Interactive chart is shown on larger screens for smoother performance on mobile.
      </p>
    </div>
  );
}

export function ProfitGrowthChart(props: { data: ProfitChartDatum[] }) {
  const liteRendering = useLiteChartRendering();

  if (liteRendering) {
    return (
      <div className="chart-panel-stable min-h-[200px] w-full">
        <MobileProfitSummary data={props.data} />
      </div>
    );
  }

  return (
    <div
      className="chart-panel-stable min-h-[240px] w-full sm:min-h-[280px] md:min-h-[300px]"
      style={{ height: 300 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={props.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#facc15" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />

          <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} />

          <YAxis stroke="#71717a" tick={{ fontSize: 11 }} width={44} />

          <Tooltip
            formatter={(value) => formatUsdAmount(Number(value ?? 0))}
            contentStyle={{
              backgroundColor: "#09090b",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
            }}
          />

          <Area
            type="monotone"
            dataKey="profit"
            stroke="#facc15"
            fill="url(#profit)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
