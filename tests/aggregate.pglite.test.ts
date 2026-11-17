// 集計RPCの突合テスト(手元のPGliteで実行)
// Supabase と同じSQLを流し、取り込み → 置き換え → 削除と状態を変えながら、
// 正解データと1円単位で一致するかを確かめる。本番のデータは使わない
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, test } from "vitest";
import {
  compute,
  loadExpected,
  replaceMonths,
  type CubeRow,
  type Filter,
} from "./helpers/expected";

const sql = (file: string) =>
  readFileSync(join(process.cwd(), "supabase", file), "utf8");

// CSVを読む(テストのデータ投入用。区切りはカンマのみのデータを前提)
function readCsv(name: string) {
  const text = readFileSync(join(process.cwd(), "data", `${name}.csv`), "utf8")
    .replace(/^﻿/, "")
    .trim();
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const c = line.split(",");
      return {
        sale_id: c[0],
        sale_date: c[1],
        category: c[2],
        product_name: c[3],
        sales_rep: c[4],
        quantity: Number(c[5]),
        unit_price: Number(c[6]),
        amount: Number(c[7]),
      };
    });
}

let db: PGlite;

// 画面の取り込み(importSales)と同じ手順をSQLで行う
async function importCsv(name: string): Promise<string> {
  const rows = readCsv(name);
  const dates = rows.map((r) => r.sale_date).sort();
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const { rows: up } = await db.query<{ id: string }>(
    `insert into public.uploads
       (file_name, period_from, period_to, row_count, total_amount, original_row_count, original_total_amount)
     values ($1, $2, $3, $4, $5, $4, $5) returning id`,
    [`${name}.csv`, dates[0], dates.at(-1), rows.length, total],
  );
  const id = up[0].id;
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const params: unknown[] = [];
    const values = chunk.map((r, j) => {
      params.push(id, r.sale_id, r.sale_date, r.category, r.product_name,
        r.sales_rep, r.quantity, r.unit_price, r.amount);
      const b = j * 9;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
    });
    await db.query(
      `insert into public.sales
         (upload_id, sale_id, sale_date, category, product_name, sales_rep, quantity, unit_price, amount)
       values ${values.join(",")}`,
      params,
    );
  }
  await db.query("select * from public.commit_upload($1)", [id]);
  return id;
}

const args = (f: Filter) => [
  `${f.from}-01`,
  `${f.to}-01`,
  f.categories ?? null,
  f.reps ?? null,
];
const num = (v: unknown) => (v === null ? null : Number(v));

// RPCの結果と正解を比べる
async function check(cube: CubeRow[], f: Filter) {
  const exp = compute(cube, f);

  const kpi = (
    await db.query<Record<string, unknown>>(
      "select * from public.get_kpi_summary($1, $2, $3, $4)",
      args(f),
    )
  ).rows[0];
  expect({
    current: num(kpi.current_amount),
    previous: num(kpi.previous_amount),
    yoy: num(kpi.yoy_pct),
  }).toEqual(exp.kpi);

  const monthly = (
    await db.query<Record<string, unknown>>(
      "select to_char(month, 'YYYY-MM-DD') as month, current_amount, previous_amount from public.get_monthly_sales($1, $2, $3, $4)",
      args(f),
    )
  ).rows.map((r) => ({
    month: r.month,
    current: num(r.current_amount),
    previous: num(r.previous_amount),
  }));
  expect(monthly).toEqual(exp.monthly);

  const products = (
    await db.query<Record<string, unknown>>(
      "select * from public.get_product_sales($1, $2, $3, $4)",
      args(f),
    )
  ).rows;
  expect(
    new Map(
      products.map((r) => [
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
  // 当期売上の多い順に並んでいるか
  const currents = products.map((r) => Number(r.current_amount));
  expect(currents).toEqual([...currents].sort((a, b) => b - a));
}

const sample = loadExpected("sales_sample_1k");
const replacement = loadExpected("sales_replace_2026_10");
const categories = Object.keys(sample.byCategory);
const reps = Object.keys(sample.byRep);

// 絞り込みの組み合わせ
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

beforeAll(async () => {
  db = new PGlite();
  // Supabase にある auth スキーマとロールの代わり
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{"email":"test@example.com"}'::jsonb $$;
    create role anon;
    create role authenticated;
  `);
  await db.exec(sql("step2_schema.sql"));
  await db.exec(sql("step6_import.sql"));
  await db.exec(sql("step7_aggregate.sql"));
}, 60_000);

describe("PGlite:取り込み → 置き換え → 削除", () => {
  let replaceId = "";

  describe("① サンプルを取り込んだ状態", () => {
    beforeAll(async () => {
      await importCsv("sales_sample_1k");
    });
    test.each(filters)("%s", async (_, f) => {
      await check(sample.cube, f);
    });
  });

  describe("② 置き換え用(2026年10月)を取り込んだ状態", () => {
    beforeAll(async () => {
      replaceId = await importCsv("sales_replace_2026_10");
    });
    const cube = replaceMonths(sample.cube, replacement.cube, ["2026-10"]);
    test.each(filters)("%s", async (_, f) => {
      await check(cube, f);
    });
  });

  describe("③ 置き換え用を履歴から削除した状態(10月は空になる)", () => {
    beforeAll(async () => {
      await db.query("delete from public.uploads where id = $1", [replaceId]);
    });
    const cube = replaceMonths(sample.cube, [], ["2026-10"]);
    test.each(filters)("%s", async (_, f) => {
      await check(cube, f);
    });
  });
});
