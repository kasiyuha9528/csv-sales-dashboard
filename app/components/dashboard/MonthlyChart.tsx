"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { MonthlyRow } from "@/lib/dashboard/fetchDashboard";
import type { ChartType } from "@/lib/dashboard/params";
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

export default function MonthlyChart({
  rows,
  initialChart,
}: {
  rows: MonthlyRow[];
  initialChart: ChartType;
}) {
  const [chart, setChart] = useState<ChartType>(initialChart);

  // 切り替えたら、URLの chart だけを書き換える(集計は取り直さない)
  function switchTo(next: ChartType) {
    setChart(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "bar") params.set("chart", "bar");
    else params.delete("chart");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">月次売上推移</h2>
        <div
          role="group"
          aria-label="グラフの種類"
          className="flex rounded-[9px] bg-[#EEF0F3] p-[3px]"
        >
          {(
            [
              ["bar", "棒グラフ"],
              ["line", "折れ線"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={chart === value}
              onClick={() => switchTo(value)}
              className={
                chart === value
                  ? "min-h-[34px] rounded-[7px] bg-white px-4 text-sm font-bold shadow-sm"
                  : "min-h-[34px] rounded-[7px] px-4 text-sm text-[#5B6270]"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
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
            <Tooltip content={ChartTooltip} cursor={{ fill: "#F4F5F7" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {chart === "bar" && (
              <Bar
                dataKey="current"
                name="当年"
                fill={CURRENT}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={false}
              />
            )}
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
            {chart === "line" && (
              <Line
                type="monotone"
                dataKey="current"
                name="当年"
                stroke={CURRENT}
                strokeWidth={3}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
