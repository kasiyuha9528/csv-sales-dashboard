// 売上CSVを読み込み、検証して、取り込める形に変換する(ブラウザで実行)
import Papa from "papaparse";

export const REQUIRED_COLUMNS = [
  "sale_id",
  "sale_date",
  "category",
  "product_name",
  "sales_rep",
  "quantity",
  "unit_price",
  "amount",
] as const;

type Column = (typeof REQUIRED_COLUMNS)[number];

// 取り込む1行分(Supabaseの sales テーブルと同じ形)
export type SaleRow = {
  sale_id: string;
  sale_date: string; // YYYY-MM-DD
  category: string;
  product_name: string;
  sales_rep: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

// 取り込めない行(行番号はファイル上の行。見出しが1行目)
export type RowError = {
  line: number;
  column: Column | "";
  value: string;
  message: string;
};

// 数量×単価 ≠ 金額 の行(警告のみ)
export type Mismatch = {
  line: number;
  sale_id: string;
  quantity: number;
  unit_price: number;
  expected: number;
  amount: number;
};

export type ParseSuccess = {
  ok: true;
  encoding: string;
  rows: SaleRow[];
  rowCount: number;
  periodFrom: string;
  periodTo: string;
  totalAmount: number;
  mismatches: Mismatch[];
};

export type ParseFailure = {
  ok: false;
  message: string;
  errors: RowError[];
};

export type ParseResult = ParseSuccess | ParseFailure;

// ---------- 文字コード ----------
// BOM付きUTF-8 → UTF-8 → Shift_JIS の順に試す
function decode(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    // fatal: true → UTF-8として正しくない並びがあればエラーにする
    // BOMは TextDecoder が自動で取り除く
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text, encoding: hasBom ? "UTF-8(BOM付き)" : "UTF-8" };
  } catch {
    const text = new TextDecoder("shift_jis").decode(bytes);
    return { text, encoding: "Shift_JIS" };
  }
}

// ---------- 値の変換 ----------
// 全角数字・カンマ区切り("1,500")に対応して整数にする。だめなら null
function toInt(raw: string): number | null {
  const s = raw.normalize("NFKC").replace(/,/g, "").trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

// "2024-11-01" / "2024/11/1" → "2024-11-01"。存在しない日付は null
function toDate(raw: string): string | null {
  const m = raw
    .normalize("NFKC")
    .trim()
    .match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // 2月30日などを Date が翌月に直してしまうので、変わっていないか確かめる
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------- メイン ----------
export async function parseSalesCsv(file: File): Promise<ParseResult> {
  if (!/\.csv$/i.test(file.name)) {
    return {
      ok: false,
      message: "CSVファイル(UTF-8またはShift_JIS)を選んでください",
      errors: [],
    };
  }

  const { text, encoding } = decode(await file.arrayBuffer());

  // 列の区切り・ダブルクォートの処理は Papa Parse に任せる
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const table = parsed.data;

  const header = (table[0] ?? []).map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `必要な列(${missing.join(", ")})がありません。CSVの1行目を確認してください`,
      errors: [],
    };
  }
  const index = Object.fromEntries(
    REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)]),
  ) as Record<Column, number>;

  const rows: SaleRow[] = [];
  const errors: RowError[] = [];
  const mismatches: Mismatch[] = [];
  let totalAmount = 0;
  let periodFrom = "";
  let periodTo = "";

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    // 空行(ファイル末尾の改行など)は読み飛ばす
    if (cells.every((c) => c.trim() === "")) continue;

    const line = i + 1;
    const get = (c: Column) => (cells[index[c]] ?? "").trim();
    const err = (column: Column, message: string) =>
      errors.push({ line, column, value: get(column), message });

    const date = toDate(get("sale_date"));
    const quantity = toInt(get("quantity"));
    const unitPrice = toInt(get("unit_price"));
    const amount = toInt(get("amount"));

    const before = errors.length;
    for (const c of ["sale_id", "category", "product_name", "sales_rep"] as const) {
      if (!get(c)) err(c, "必須項目が空です");
    }
    if (!date) err("sale_date", "日付として読めません");
    if (quantity === null) err("quantity", "整数ではありません");
    if (unitPrice === null) err("unit_price", "整数ではありません");
    if (amount === null) err("amount", "整数ではありません");
    if (errors.length > before) continue;

    const row: SaleRow = {
      sale_id: get("sale_id"),
      sale_date: date!,
      category: get("category"),
      product_name: get("product_name"),
      sales_rep: get("sales_rep"),
      quantity: quantity!,
      unit_price: unitPrice!,
      amount: amount!,
    };

    if (row.quantity * row.unit_price !== row.amount) {
      mismatches.push({
        line,
        sale_id: row.sale_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        expected: row.quantity * row.unit_price,
        amount: row.amount,
      });
    }

    totalAmount += row.amount;
    if (!periodFrom || row.sale_date < periodFrom) periodFrom = row.sale_date;
    if (!periodTo || row.sale_date > periodTo) periodTo = row.sale_date;
    rows.push(row);
  }

  // 1行でも読めない行があれば、ファイル全体を取り込まない
  if (errors.length > 0) {
    const lines = new Set(errors.map((e) => e.line)).size;
    return {
      ok: false,
      message: `解釈できない行が ${lines.toLocaleString("ja-JP")} 件あります。CSVを修正して再度選択してください`,
      errors,
    };
  }

  if (rows.length === 0) {
    return { ok: false, message: "データの行がありません", errors: [] };
  }

  return {
    ok: true,
    encoding,
    rows,
    rowCount: rows.length,
    periodFrom,
    periodTo,
    totalAmount,
    mismatches,
  };
}
