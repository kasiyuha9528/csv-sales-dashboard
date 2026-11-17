// 突合用の「正解データ」を作るスクリプト
//
// 使い方:
//   node scripts/make-expected.mjs data/sales_sample_1k.csv
//   → data/expected/sales_sample_1k.json を書き出す
//
// 方針:
// - アプリのコード(取り込み・集計RPC)は使わず、CSVを直接読んで計算する
//   (同じロジックを使うと、間違いも一緒にコピーされて突合の意味がなくなるため)
// - 追加のパッケージは使わず、Node.jsだけで動かす
// - 結果は「月 × カテゴリ × 商品 × 担当者」の細かい合計(cube)で持つ。
//   テストでは、ここから任意の絞り込み条件の正解を計算する

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const REQUIRED = [
  "sale_id",
  "sale_date",
  "category",
  "product_name",
  "sales_rep",
  "quantity",
  "unit_price",
  "amount",
];

// ---------- 文字コード ----------
// BOM付きUTF-8 → BOMを外す。UTF-8として読めなければ Shift_JIS として読む
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString("utf8"), encoding: "UTF-8 (BOM付き)" };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return { text, encoding: "UTF-8" };
  } catch {
    const text = new TextDecoder("shift_jis").decode(buf);
    return { text, encoding: "Shift_JIS" };
  }
}

// ---------- CSVの1行を列に分ける(ダブルクォート対応) ----------
function parseLine(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

// ---------- 値の変換 ----------
// 全角数字・カンマ区切り("1,500")に対応して整数にする
function toInt(raw) {
  const s = raw
    .normalize("NFKC")
    .replace(/,/g, "")
    .trim();
  if (!/^-?\d+$/.test(s)) return null;
  return Number(s);
}

// "2024-11-01" / "2024/11/1" → "2024-11-01"。存在しない日付は null
function toDate(raw) {
  const m = raw.normalize("NFKC").trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------- メイン ----------
const input = process.argv[2];
if (!input) {
  console.error("使い方: node scripts/make-expected.mjs <CSVファイルのパス>");
  process.exit(1);
}

const { text, encoding } = decode(readFileSync(input));
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
const header = parseLine(lines[0]).map((h) => h.trim());

const missing = REQUIRED.filter((c) => !header.includes(c));
if (missing.length > 0) {
  console.error(`必須の列がありません: ${missing.join(", ")}`);
  process.exit(1);
}
const col = Object.fromEntries(REQUIRED.map((c) => [c, header.indexOf(c)]));

const errors = [];
let mismatch = 0; // 数量×単価 ≠ 金額 の行(警告のみ)
let totalAmount = 0;
let periodFrom = null;
let periodTo = null;
const cube = new Map(); // "月|カテゴリ|商品|担当者" → { amount, quantity, rows }

for (let i = 1; i < lines.length; i++) {
  const lineNo = i + 1; // ファイル上の行番号(見出しが1行目)
  const cells = parseLine(lines[i]);
  const get = (c) => (cells[col[c]] ?? "").trim();

  const date = toDate(get("sale_date"));
  const quantity = toInt(get("quantity"));
  const unitPrice = toInt(get("unit_price"));
  const amount = toInt(get("amount"));
  const category = get("category");
  const product = get("product_name");
  const rep = get("sales_rep");

  const bad = [];
  if (!get("sale_id")) bad.push("sale_id が空");
  if (!date) bad.push(`sale_date が日付ではない(${get("sale_date")})`);
  if (!category) bad.push("category が空");
  if (!product) bad.push("product_name が空");
  if (!rep) bad.push("sales_rep が空");
  if (quantity === null) bad.push(`quantity が整数ではない(${get("quantity")})`);
  if (unitPrice === null) bad.push(`unit_price が整数ではない(${get("unit_price")})`);
  if (amount === null) bad.push(`amount が整数ではない(${get("amount")})`);
  if (bad.length > 0) {
    errors.push(`${lineNo}行目: ${bad.join(" / ")}`);
    continue;
  }

  if (quantity * unitPrice !== amount) mismatch++;

  totalAmount += amount;
  if (!periodFrom || date < periodFrom) periodFrom = date;
  if (!periodTo || date > periodTo) periodTo = date;

  const key = [date.slice(0, 7), category, product, rep].join("|");
  const cell = cube.get(key) ?? { amount: 0, quantity: 0, rows: 0 };
  cell.amount += amount;
  cell.quantity += quantity;
  cell.rows += 1;
  cube.set(key, cell);
}

// 正解データに不正な行が混ざると突合の意味がないので、1件でもあれば止める
if (errors.length > 0) {
  console.error(`解釈できない行が ${errors.length} 件あります(正解データは作りません)`);
  errors.slice(0, 20).forEach((e) => console.error("  " + e));
  if (errors.length > 20) console.error(`  ほか ${errors.length - 20} 件`);
  process.exit(1);
}

// cube を配列にし、よく使う切り口の合計も添える
const rows = [...cube.entries()]
  .map(([key, v]) => {
    const [month, category, product, rep] = key.split("|");
    return { month, category, product, rep, ...v };
  })
  .sort((a, b) =>
    (a.month + a.category + a.product + a.rep).localeCompare(
      b.month + b.category + b.product + b.rep,
    ),
  );

const sumBy = (field) => {
  const out = {};
  for (const r of rows) out[r[field]] = (out[r[field]] ?? 0) + r.amount;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
};

const result = {
  source: basename(input),
  encoding,
  rowCount: lines.length - 1,
  totalAmount,
  periodFrom,
  periodTo,
  mismatchCount: mismatch,
  monthly: sumBy("month"),
  byCategory: sumBy("category"),
  byProduct: sumBy("product"),
  byRep: sumBy("rep"),
  cube: rows,
};

const outDir = join(dirname(input), "expected");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, basename(input).replace(/\.csv$/i, "") + ".json");
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");

console.log(`書き出し: ${outPath}`);
console.log(`  文字コード: ${encoding}`);
console.log(`  行数: ${result.rowCount.toLocaleString()} 行`);
console.log(`  期間: ${periodFrom} 〜 ${periodTo}`);
console.log(`  合計金額: ${totalAmount.toLocaleString()} 円`);
console.log(`  数量×単価 ≠ 金額: ${mismatch} 件(警告のみ)`);
