"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import {
  parseSalesCsv,
  type ParseFailure,
  type ParseSuccess,
} from "@/lib/csv/parseSalesCsv";

type State =
  | { stage: "select" }
  | { stage: "reading" }
  | { stage: "error"; fileName: string; result: ParseFailure }
  | { stage: "preview"; fileName: string; result: ParseSuccess; ms: number };

const STEPS = ["1. ファイルを選択", "2. 内容を確認", "3. 取り込み完了"];
const MAX_LIST = 100; // エラー・警告の一覧に出す最大件数

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const num = (n: number) => n.toLocaleString("ja-JP");

export default function UploadForm() {
  const [state, setState] = useState<State>({ stage: "select" });
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setState({ stage: "reading" });
    const start = performance.now();
    const result = await parseSalesCsv(file);
    const ms = performance.now() - start;
    setState(
      result.ok
        ? { stage: "preview", fileName: file.name, result, ms }
        : { stage: "error", fileName: file.name, result },
    );
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを選び直しても反応するようにする
    if (file) handleFile(file);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const reset = () => setState({ stage: "select" });
  const stepIndex = state.stage === "preview" ? 1 : 0;

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="手順" className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              i === stepIndex
                ? "rounded-full bg-[#2F5BD3] px-3.5 py-2 font-semibold text-white"
                : "rounded-full bg-[#E6E9EE] px-3.5 py-2 text-[#3D434D]"
            }
          >
            {label}
          </li>
        ))}
      </ol>

      {(state.stage === "select" || state.stage === "reading") && (
        <section
          aria-label="ファイル選択"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3.5 rounded-xl border-2 border-dashed px-6 py-14 text-center ${
            dragging ? "border-[#2F5BD3] bg-[#EEF2FC]" : "border-[#A9B4C6] bg-white"
          }`}
        >
          {state.stage === "reading" ? (
            <p className="font-bold">読み込み中…</p>
          ) : (
            <>
              <p className="text-lg font-bold">CSVファイルをここにドラッグ&amp;ドロップ</p>
              <p className="text-sm text-[#5B6270]">または</p>
              <label className="cursor-pointer rounded-lg bg-[#2F5BD3] px-5 py-3 text-sm font-bold text-white">
                ファイルを選択
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onInputChange}
                  className="sr-only"
                />
              </label>
              <p className="text-xs leading-relaxed text-[#5B6270]">
                UTF-8 / Shift_JIS 対応・1行目は見出し・10万行程度まで
                <br />
                必須列:{" "}
                sale_id, sale_date, category, product_name, sales_rep, quantity,
                unit_price, amount
              </p>
            </>
          )}
        </section>
      )}

      {state.stage === "error" && (
        <section
          aria-label="エラー"
          className="flex flex-col gap-4 rounded-xl border border-[#E2E5EA] bg-white p-6"
        >
          <p
            role="alert"
            className="rounded-lg bg-[#FDF0EA] px-4 py-3.5 text-sm leading-relaxed text-[#8A2F08]"
          >
            <strong>取り込めません:</strong>
            {state.result.message}({state.fileName})
          </p>

          {state.result.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E2E5EA] text-left text-[#5B6270]">
                    <th className="px-2 py-2.5 font-semibold">行</th>
                    <th className="px-2 py-2.5 font-semibold">列</th>
                    <th className="px-2 py-2.5 font-semibold">値</th>
                    <th className="px-2 py-2.5 font-semibold">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {state.result.errors.slice(0, MAX_LIST).map((e, i) => (
                    <tr key={i} className="border-b border-[#F0F1F4]">
                      <td className="px-2 py-2.5">{num(e.line)}</td>
                      <td className="px-2 py-2.5">{e.column}</td>
                      <td className="px-2 py-2.5">{e.value || "(空欄)"}</td>
                      <td className="px-2 py-2.5">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.result.errors.length > MAX_LIST && (
                <p className="mt-2 text-sm text-[#5B6270]">
                  ほか {num(state.result.errors.length - MAX_LIST)} 件
                </p>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-[#C9CED6] px-5 py-3 text-sm font-semibold"
            >
              ファイルを選び直す
            </button>
          </div>
        </section>
      )}

      {state.stage === "preview" && (
        <Preview
          fileName={state.fileName}
          result={state.result}
          ms={state.ms}
          onCancel={reset}
        />
      )}
    </div>
  );
}

function Preview({
  fileName,
  result,
  ms,
  onCancel,
}: {
  fileName: string;
  result: ParseSuccess;
  ms: number;
  onCancel: () => void;
}) {
  const summary = [
    ["ファイル", fileName],
    ["文字コード", result.encoding],
    ["行数", `${num(result.rowCount)} 行`],
    ["対象期間", `${result.periodFrom} 〜 ${result.periodTo}`],
    ["合計金額", yen(result.totalAmount)],
    ["読み込み時間", `${(ms / 1000).toFixed(2)} 秒`],
  ];

  return (
    <section aria-label="取り込み内容の確認" className="flex flex-col gap-4">
      <dl className="flex flex-wrap gap-x-10 gap-y-5 rounded-xl border border-[#E2E5EA] bg-white px-6 py-5">
        {summary.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-[#5B6270]">{label}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {result.mismatches.length === 0 ? (
        <p className="rounded-xl border border-[#E2E5EA] bg-white px-5 py-4 text-sm font-semibold text-[#145C37]">
          数量 × 単価 と金額はすべて一致しています
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[#E2E5EA] bg-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">
              警告:数量 × 単価 と金額が一致しない行 {num(result.mismatches.length)} 件
            </p>
            <p className="text-xs text-[#5B6270]">
              値引きなどの可能性があるため、取り込みは可能です
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E5EA] text-left text-[#5B6270]">
                  <th className="p-2 font-semibold">行</th>
                  <th className="p-2 font-semibold">sale_id</th>
                  <th className="p-2 text-right font-semibold">数量</th>
                  <th className="p-2 text-right font-semibold">単価</th>
                  <th className="p-2 text-right font-semibold">計算値</th>
                  <th className="p-2 text-right font-semibold">金額</th>
                </tr>
              </thead>
              <tbody>
                {result.mismatches.slice(0, MAX_LIST).map((m) => (
                  <tr key={m.line} className="border-b border-[#F0F1F4]">
                    <td className="p-2">{num(m.line)}</td>
                    <td className="p-2">{m.sale_id}</td>
                    <td className="p-2 text-right">{num(m.quantity)}</td>
                    <td className="p-2 text-right">{yen(m.unit_price)}</td>
                    <td className="p-2 text-right">{yen(m.expected)}</td>
                    <td className="p-2 text-right font-semibold">{yen(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.mismatches.length > MAX_LIST && (
              <p className="mt-2 text-sm text-[#5B6270]">
                ほか {num(result.mismatches.length - MAX_LIST)} 件
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 rounded-xl border border-[#E2E5EA] bg-white px-5 py-4">
        <p className="text-sm font-bold">プレビュー(先頭5行)</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E2E5EA] text-left text-[#5B6270]">
                <th className="p-2 font-semibold">sale_id</th>
                <th className="p-2 font-semibold">売上日</th>
                <th className="p-2 font-semibold">カテゴリ</th>
                <th className="p-2 font-semibold">商品名</th>
                <th className="p-2 font-semibold">担当者</th>
                <th className="p-2 text-right font-semibold">数量</th>
                <th className="p-2 text-right font-semibold">単価</th>
                <th className="p-2 text-right font-semibold">金額</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 5).map((r) => (
                <tr key={r.sale_id} className="border-b border-[#F0F1F4]">
                  <td className="p-2">{r.sale_id}</td>
                  <td className="p-2">{r.sale_date}</td>
                  <td className="p-2">{r.category}</td>
                  <td className="p-2">{r.product_name}</td>
                  <td className="p-2">{r.sales_rep}</td>
                  <td className="p-2 text-right">{num(r.quantity)}</td>
                  <td className="p-2 text-right">{yen(r.unit_price)}</td>
                  <td className="p-2 text-right">{yen(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#C9CED6] bg-white px-5 py-3 text-sm font-semibold"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled
          title="取り込みはStep 6で実装します"
          className="rounded-lg bg-[#2F5BD3] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          取り込む(Step 6で実装)
        </button>
      </div>
    </section>
  );
}
