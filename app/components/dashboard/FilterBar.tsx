"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardFilter } from "@/lib/dashboard/fetchDashboard";
import { toggleChip, toQuery, type ChartType } from "@/lib/dashboard/params";
import { addMonths, monthLabel } from "@/lib/dashboard/period";
import { markStart } from "@/lib/perf/marks";

type Props = {
  filter: DashboardFilter;
  minMonth: string;
  maxMonth: string;
  categories: string[];
  reps: string[];
};

export default function FilterBar({ filter, minMonth, maxMonth, categories, reps }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 選べる月の一覧(データがある最初の月〜最後の月)
  const months: string[] = [];
  for (let m = minMonth; m <= maxMonth; m = addMonths(m, 1)) months.push(m);

  // 条件を変えたら URL を変える → サーバーで集計を取り直す
  // グラフの種類は FilterBar では持っていないので、今のURLから引き継ぐ
  function go(next: DashboardFilter | null) {
    const chart: ChartType =
      new URLSearchParams(window.location.search).get("chart") === "bar" ? "bar" : "line";
    const url = next ? `/?${toQuery(next, chart)}` : chart === "bar" ? "/?chart=bar" : "/";
    markStart("filter"); // 性能の計測(Step 10)
    startTransition(() => router.push(url, { scroll: false }));
  }

  function setFrom(from: string) {
    go({ ...filter, from, to: filter.to < from ? from : filter.to });
  }
  function setTo(to: string) {
    go({ ...filter, to, from: filter.from > to ? to : filter.from });
  }

  return (
    <section
      aria-label="絞り込み"
      aria-busy={isPending}
      className="flex flex-col gap-3.5 rounded-xl border border-[#E2E5EA] bg-white px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-sm font-bold text-[#3D434D]">期間</span>
          <label htmlFor="from" className="sr-only">
            開始月
          </label>
          <select
            id="from"
            value={filter.from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-lg border border-[#C9CED6] bg-white px-2.5 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <span className="text-[#5B6270]">〜</span>
          <label htmlFor="to" className="sr-only">
            終了月
          </label>
          <select
            id="to"
            value={filter.to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-lg border border-[#C9CED6] bg-white px-2.5 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          {isPending && (
            <span role="status" className="ml-2 text-sm text-[#5B6270]">
              更新中…
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => go(null)}
          className="min-h-9 px-3 text-sm text-[#2F5BD3]"
        >
          条件をリセット
        </button>
      </div>

      <ChipRow
        label="カテゴリ"
        all={categories}
        selected={filter.categories}
        onChange={(categories) => go({ ...filter, categories })}
      />
      <ChipRow
        label="担当者"
        all={reps}
        selected={filter.reps}
        onChange={(reps) => go({ ...filter, reps })}
      />
    </section>
  );
}

function ChipRow({
  label,
  all,
  selected,
  onChange,
}: {
  label: string;
  all: string[];
  selected: string[]; // 空なら「すべて」
  onChange: (next: string[]) => void;
}) {
  const isAll = selected.length === 0;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-sm font-bold text-[#3D434D]">{label}</span>
      <Chip active={isAll} onClick={() => onChange([])}>
        すべて
      </Chip>
      {all.map((item) => (
        <Chip
          key={item}
          active={!isAll && selected.includes(item)}
          onClick={() => onChange(toggleChip(selected, item, all))}
        >
          {item}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "min-h-9 rounded-full border border-[#2F5BD3] bg-[#2F5BD3] px-3.5 text-sm font-semibold text-white"
          : "min-h-9 rounded-full border border-[#C9CED6] bg-white px-3.5 text-sm text-[#3D434D]"
      }
    >
      {children}
    </button>
  );
}
