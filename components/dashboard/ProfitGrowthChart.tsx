"use client";

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

export interface ProfitChartDatum {
  id: number;
  date: string;
  profit: number;
}

export function ProfitGrowthChart(props: { data: ProfitChartDatum[] }) {
  return (
    <div
      className="min-h-[240px] w-full sm:min-h-[280px] md:min-h-[300px]"
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
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
