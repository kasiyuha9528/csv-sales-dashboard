// 絞り込みのルール(URLの読み取り・チップの選び方)のテスト
import { describe, expect, test } from "vitest";
import { parseParams, toggleChip, toQuery } from "../lib/dashboard/params";

const options = {
  minMonth: "2024-11-01",
  maxMonth: "2026-10-01",
  categories: ["家電", "食品", "飲料"],
  reps: ["伊藤", "田中"],
};

describe("parseParams:URL → 条件", () => {
  test("何もなければ直近12か月・すべて・折れ線", () => {
    expect(parseParams({}, options)).toEqual({
      filter: { from: "2025-11-01", to: "2026-10-01", categories: [], reps: [] },
      chart: "line",
    });
  });

  test("指定どおりに読む(カテゴリ・担当者は選択肢の順に並べ直す)", () => {
    const r = parseParams(
      { from: "2025-01", to: "2025-06", cat: ["飲料", "家電"], rep: "田中", chart: "bar" },
      options,
    );
    expect(r).toEqual({
      filter: { from: "2025-01-01", to: "2025-06-01", categories: ["家電", "飲料"], reps: ["田中"] },
      chart: "bar",
    });
  });

  test("データの範囲外の月は、範囲の端に寄せる", () => {
    const r = parseParams({ from: "2020-01", to: "2030-12" }, options);
    expect([r.filter.from, r.filter.to]).toEqual(["2024-11-01", "2026-10-01"]);
  });

  test("開始月が終了月より後なら入れ替える", () => {
    const r = parseParams({ from: "2026-03", to: "2025-12" }, options);
    expect([r.filter.from, r.filter.to]).toEqual(["2025-12-01", "2026-03-01"]);
  });

  test("おかしな値は無視する", () => {
    const r = parseParams(
      { from: "2025-13", to: "abc", cat: ["存在しない"], chart: "pie" },
      options,
    );
    expect(r).toEqual(parseParams({}, options));
  });

  test("全部選ばれていたら「すべて」(空)にする", () => {
    const r = parseParams({ cat: ["家電", "食品", "飲料"] }, options);
    expect(r.filter.categories).toEqual([]);
  });
});

describe("toQuery:条件 → URL", () => {
  test("折れ線のときは chart を付けない", () => {
    expect(
      toQuery({ from: "2025-11-01", to: "2026-10-01", categories: ["食品"], reps: [] }, "line"),
    ).toBe("from=2025-11&to=2026-10&cat=%E9%A3%9F%E5%93%81");
  });

  test("URL → 条件 → URL で元に戻る", () => {
    const { filter, chart } = parseParams(
      { from: "2025-01", to: "2025-06", cat: ["家電", "飲料"], rep: ["田中"], chart: "bar" },
      options,
    );
    // Next.js の searchParams と同じ形にする(値が1つなら文字列、複数なら配列)
    const q = new URLSearchParams(toQuery(filter, chart));
    const back = Object.fromEntries(
      [...new Set(q.keys())].map((k) => {
        const v = q.getAll(k);
        return [k, v.length === 1 ? v[0] : v];
      }),
    );
    expect(parseParams(back, options)).toEqual({ filter, chart });
  });
});

describe("toggleChip:チップの選び方", () => {
  const all = ["家電", "食品", "飲料"];
  test("「すべて」の状態で個別を押すと、それだけになる", () => {
    expect(toggleChip([], "食品", all)).toEqual(["食品"]);
  });
  test("選んでいないものを押すと追加する(選択肢の順)", () => {
    expect(toggleChip(["飲料"], "家電", all)).toEqual(["家電", "飲料"]);
  });
  test("全部選ばれたら「すべて」に戻る", () => {
    expect(toggleChip(["家電", "食品"], "飲料", all)).toEqual([]);
  });
  test("選んでいるものを押すと外す。全部外れたら「すべて」に戻る", () => {
    expect(toggleChip(["家電", "食品"], "家電", all)).toEqual(["食品"]);
    expect(toggleChip(["食品"], "食品", all)).toEqual([]);
  });
});
