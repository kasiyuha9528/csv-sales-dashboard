// 集計RPCの突合テスト(本番の Supabase で実行)
// 取り込み済みの10万行版に対して、絞り込みの組み合わせごとに
// 正解データと1円単位で一致するかを確かめる。データは読むだけで変更しない
//
// 前提:
// - Supabase に取り込まれている有効なデータが、sales_100k.csv だけであること
// - .env.local に TEST_USER_EMAIL・TEST_USER_PASSWORD があること
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";
import { compute, loadExpected, type Filter } from "./helpers/expected";

const expected = loadExpected("sales_100k");
const categories = Object.keys(expected.byCategory);
const reps = Object.keys(expected.byRep);

const filters: [string, Filter][] = [
  ["当期12か月・すべて", { from: "2025-11", to: "2026-10" }],
  ["全24か月(前半は前年なし)", { from: "2024-11", to: "2026-10" }],
  ["1か月だけ", { from: "2026-10", to: "2026-10" }],
  ["年をまたぐ2か月", { from: "2025-12", to: "2026-01" }],
  ["カテゴリ1つ", { from: "2025-11", to: "2026-10", categories: [categories[0]] }],
  ["担当者2人", { from: "2025-11", to: "2026-10", reps: reps.slice(0, 2) }],
  [
    "カテゴリ2つ × 担当者1人",
    { from: "2025-11", to: "2026-10", categories: categories.slice(0, 2), reps: [reps[0]] },
  ],
  ["該当なし", { from: "2025-11", to: "2026-10", categories: ["存在しないカテゴリ"] }],
];

let supabase: SupabaseClient;

const params = (f: Filter) => ({
  p_from_month: `${f.from}-01`,
  p_to_month: `${f.to}-01`,
  p_categories: f.categories ?? null,
  p_reps: f.reps ?? null,
});
const num = (v: unknown) => (v === null ? null : Number(v));

beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!url || !key || !email || !password) {
    throw new Error(
      ".env.local に NEXT_PUBLIC_SUPABASE_URL・NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY・TEST_USER_EMAIL・TEST_USER_PASSWORD を設定してください",
    );
  }
  supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // 前提の確認:有効なデータが10万行版と同じ合計になっているか
  const { data, error: e } = await supabase.rpc("get_kpi_summary", {
    p_from_month: `${expected.periodFrom.slice(0, 7)}-01`,
    p_to_month: `${expected.periodTo.slice(0, 7)}-01`,
  });
  if (e) throw e;
  if (Number(data[0].current_amount) !== expected.totalAmount) {
    throw new Error(
      `Supabase の有効なデータの合計(${data[0].current_amount})が、sales_100k の合計(${expected.totalAmount})と違います。取り込み履歴を sales_100k.csv だけにしてから実行してください`,
    );
  }
}, 30_000);

describe("Supabase:10万行版", () => {
  test.each(filters)("%s", async (_, f) => {
    const exp = compute(expected.cube, f);

    const kpi = await supabase.rpc("get_kpi_summary", params(f));
    if (kpi.error) throw kpi.error;
    expect({
      current: num(kpi.data[0].current_amount),
      previous: num(kpi.data[0].previous_amount),
      yoy: num(kpi.data[0].yoy_pct),
    }).toEqual(exp.kpi);

    const monthly = await supabase.rpc("get_monthly_sales", params(f));
    if (monthly.error) throw monthly.error;
    expect(
      (monthly.data as Record<string, unknown>[]).map((r) => ({
        month: r.month,
        current: num(r.current_amount),
        previous: num(r.previous_amount),
      })),
    ).toEqual(exp.monthly);

    const products = await supabase.rpc("get_product_sales", params(f));
    if (products.error) throw products.error;
    const rows = products.data as Record<string, unknown>[];
    expect(
      new Map(
        rows.map((r) => [
          r.product_name as string,
          {
            category: r.category,
            current: num(r.current_amount),
            previous: num(r.previous_amount),
            yoy: num(r.yoy_pct),
          },
        ]),
      ),
    ).toEqual(exp.products);
    const currents = rows.map((r) => Number(r.current_amount));
    expect(currents).toEqual([...currents].sort((a, b) => b - a));
  });
});
