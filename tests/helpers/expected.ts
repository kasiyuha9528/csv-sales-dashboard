// 正解データ(data/expected/*.json)から、集計RPCと同じ条件の「正しい値」を計算する
// RPC や取り込みのコードは使わない(突合の意味がなくなるため)
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CubeRow = {
  month: string; // "2025-11"
  category: string;
  product: string;
  rep: string;
  amount: number;
};

export type Expected = {
  rowCount: number;
  totalAmount: number;
  periodFrom: string;
  periodTo: string;
  byCategory: Record<string, number>;
  byRep: Record<string, number>;
  cube: CubeRow[];
};

export type Filter = {
  from: string; // 開始月 "2025-11"
  to: string; // 終了月 "2026-10"
  categories?: string[];
  reps?: string[];
};

export function loadExpected(name: string): Expected {
  const path = join(process.cwd(), "data", "expected", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

// "2025-11" に n か月を足す
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// 前年比:(当期 − 前年同期) ÷ 前年同期 × 100 を小数第1位で四捨五入(0から遠い方へ)
// 小数の誤差が出ないよう、整数だけで計算する
export function yoyPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  // tsconfig の target(ES2017)では 1000n のような書き方が使えないので BigInt(...) で作る
  const ZERO = BigInt(0);
  const TWO = BigInt(2);
  const diff = BigInt(current - previous);
  const prev = BigInt(previous);
  const abs = diff < ZERO ? -diff : diff;
  const tenths = (abs * BigInt(1000) * TWO + prev) / (TWO * prev); // 前年比×10 を四捨五入
  const value = Number(tenths) / 10;
  return diff < ZERO && value !== 0 ? -value : value;
}

export function compute(cube: CubeRow[], f: Filter) {
  const months: string[] = [];
  for (let m = f.from; m <= f.to; m = addMonths(m, 1)) months.push(m);
  const prevFrom = addMonths(f.from, -12);
  const prevTo = addMonths(f.to, -12);

  const hit = (r: CubeRow) =>
    (!f.categories?.length || f.categories.includes(r.category)) &&
    (!f.reps?.length || f.reps.includes(r.rep));

  const monthly = new Map(months.map((m) => [m, { current: 0, previous: 0 }]));
  const products = new Map<
    string,
    { category: string; current: number; previous: number }
  >();

  for (const r of cube) {
    if (!hit(r)) continue;
    let period: "current" | "previous" | null = null;
    let month = r.month;
    if (r.month >= f.from && r.month <= f.to) period = "current";
    else if (r.month >= prevFrom && r.month <= prevTo) {
      period = "previous";
      month = addMonths(r.month, 12);
    }
    if (!period) continue;

    monthly.get(month)![period] += r.amount;
    const p = products.get(r.product) ?? {
      category: r.category,
      current: 0,
      previous: 0,
    };
    p[period] += r.amount;
    products.set(r.product, p);
  }

  const current = [...monthly.values()].reduce((a, v) => a + v.current, 0);
  const previous = [...monthly.values()].reduce((a, v) => a + v.previous, 0);

  return {
    kpi: { current, previous, yoy: yoyPct(current, previous) },
    monthly: months.map((m) => ({
      month: `${m}-01`,
      current: monthly.get(m)!.current,
      previous: monthly.get(m)!.previous,
    })),
    products: new Map(
      [...products.entries()]
        .filter(([, v]) => v.current !== 0 || v.previous !== 0)
        .map(([name, v]) => [
          name,
          { ...v, yoy: yoyPct(v.current, v.previous) },
        ]),
    ),
  };
}

// 2つの正解データを「base の一部を replace で置き換えた」状態に合成する
// (置き換えの範囲 = replace の期間。cube は月単位なので、範囲が月をまたいで
//  部分的になる場合は使えない。今回の置き換え用CSVは10月2日〜31日で、
//  サンプルの10月分の行もすべてこの範囲に入っている)
export function replaceMonths(
  base: CubeRow[],
  replacement: CubeRow[],
  months: string[],
): CubeRow[] {
  return [...base.filter((r) => !months.includes(r.month)), ...replacement];
}
