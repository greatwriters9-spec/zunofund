"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

type MiniSparklineProps = {
  data: number[];
  color: string;
  gradientId: string;
};

export function MiniSparkline({ data, color, gradientId }: MiniSparklineProps) {
  const points = data.map((value, index) => ({ index, value }));

  return (
    <div className="h-10 w-[88px] shrink-0 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Visual trend from current value and today's PNL (no new calculations). */
export function buildSparklineSeries(current: number, delta: number, points = 8): number[] {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  const start = Math.max(0, safeCurrent - safeDelta);
  if (points < 2) return [safeCurrent];
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    return start + (safeCurrent - start) * t;
  });
}
