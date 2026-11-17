// ダッシュボードの条件と、URLのパラメーター(?from=2025-11&cat=食品&chart=bar)の変換
// サーバー(ページ)とブラウザ(絞り込みの操作)の両方から使う
import type { DashboardFilter } from "@/lib/dashboard/fetchDashboard";
import { defaultPeriod } from "@/lib/dashboard/period";

export type ChartType = "line" | "bar";

export type FilterOptions = {
  minMonth: string; // "2024-11-01"
  maxMonth: string; // "2026-10-01"
  categories: string[];
  reps: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

const list = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

// 選べる値だけを、選択肢の順番で残す。全部選ばれていたら「すべて」= 空にする
function pick(values: string[], all: string[]) {
  const picked = all.filter((v) => values.includes(v));
  return picked.length === all.length ? [] : picked;
}

// URLのパラメーター → 条件。おかしな値は無視して、初期値で補う
export function parseParams(sp: SearchParams, o: FilterOptions) {
  const def = defaultPeriod(o.minMonth, o.maxMonth);
  const month = (v: string | string[] | undefined) =>
    typeof v === "string" && YM.test(v) ? `${v}-01` : null;
  const clamp = (m: string) => (m < o.minMonth ? o.minMonth : m > o.maxMonth ? o.maxMonth : m);

  let from = clamp(month(sp.from) ?? def.from);
  let to = clamp(month(sp.to) ?? def.to);
  if (from > to) [from, to] = [to, from];

  const filter: DashboardFilter = {
    from,
    to,
    categories: pick(list(sp.cat), o.categories),
    reps: pick(list(sp.rep), o.reps),
  };
  const chart: ChartType = sp.chart === "bar" ? "bar" : "line";
  return { filter, chart };
}

// 条件 → URLのパラメーター(初期値の chart=line は付けない)
export function toQuery(f: DashboardFilter, chart: ChartType) {
  const q = new URLSearchParams();
  q.set("from", f.from.slice(0, 7));
  q.set("to", f.to.slice(0, 7));
  f.categories.forEach((c) => q.append("cat", c));
  f.reps.forEach((r) => q.append("rep", r));
  if (chart === "bar") q.set("chart", "bar");
  return q.toString();
}

// チップを押したときの選び方(要件定義書 3章のルール5)
// - 「すべて」の状態で個別を押す → それだけを選ぶ
// - 選んでいるものを押す → 外す。全部外れたら「すべて」に戻る
// - 選んでいないものを押す → 追加する。全部選ばれたら「すべて」に戻る
export function toggleChip(selected: string[], item: string, all: string[]) {
  if (selected.length === 0) return [item];
  const next = selected.includes(item)
    ? selected.filter((v) => v !== item)
    : [...selected, item];
  return pick(next, all);
}
