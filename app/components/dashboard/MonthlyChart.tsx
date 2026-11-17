"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { MonthlyRow } from "@/lib/dashboard/fetchDashboard";
import { man, yen, yoyView } from "@/lib/dashboard/format";
import { monthLabel, monthShort } from "@/lib/dashboard/period";

const CURRENT = "#2F5BD3";
const PREVIOUS = "#E07B39";

type Point = {
  label: string;
  full: string;
  current: number;
  previous: number;
};

// マウスを乗せたときの吹き出し:当年・前年・前年比
function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  const yoy = yoyView(
    p.previous === 0
      ? null
      : Math.round(((p.current - p.previous) / p.previous) * 1000) / 10,
  );
  return (
    <div className="rounded-lg bg-[#1A1D21] px-3 py-2.5 text-xs leading-relaxed text-white">
      <p className="font-bold">{p.full}</p>
      <p>当年 {yen(p.current)}</p>
      <p>前年 {yen(p.previous)}</p>
      <p>前年比 {yoy.text}</p>
    </div>
  );
}

export default function MonthlyChart({ rows }: { rows: MonthlyRow[] }) {
  const data: Point[] = rows.map((r) => ({
    label: monthShort(r.month),
    full: monthLabel(r.month),
    current: r.current,
    previous: r.previous,
  }));

  return (
    <section
      aria-label="月次売上推移"
      className="rounded-xl border border-[#E2E5EA] bg-white px-6 py-5"
    >
      <h2 className="text-base font-bold">月次売上推移</h2>
      <div className="mt-4 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#ECEEF1" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#5B6270" }}
              tickLine={false}
              axisLine={{ stroke: "#C9CED6" }}
            />
            <YAxis
              tickFormatter={man}
              tick={{ fontSize: 11, fill: "#5B6270" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={ChartTooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="previous"
              name="前年同月"
              stroke={PREVIOUS}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name="当年"
              stroke={CURRENT}
              strokeWidth={3}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
