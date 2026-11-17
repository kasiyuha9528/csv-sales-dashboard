// CSVの内容を Supabase に取り込む(ブラウザで実行)
import { createClient } from "@/lib/supabase/client";
import type { ParseSuccess } from "@/lib/csv/parseSalesCsv";

const CHUNK_SIZE = 5000; // 1回に送る行数
const CONCURRENCY = 4; // 同時に送る数

export type ReplacementPreview = {
  rowCount: number; // 置き換えで消える既存の行数
  totalAmount: number; // その合計金額
  sameFileImportedAt: string | null; // 同じファイルを取り込んだ日時(なければ null)
};

export type ImportResult = {
  replacedRows: number;
  replacedAmount: number;
  ms: number;
};

// ファイルの中身から SHA-256 のハッシュ(指紋)を作る。同じファイルかどうかの判定に使う
export async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 取り込む前に、置き換わる既存データの件数・金額と、同じファイルの取り込み履歴を調べる
export async function previewReplacement(
  result: ParseSuccess,
  fileHash: string,
): Promise<ReplacementPreview> {
  const supabase = createClient();

  const [preview, same] = await Promise.all([
    supabase.rpc("preview_replacement", {
      p_from: result.periodFrom,
      p_to: result.periodTo,
    }),
    supabase
      .from("uploads")
      .select("created_at")
      .eq("file_hash", fileHash)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (preview.error) throw preview.error;
  if (same.error) throw same.error;

  const row = preview.data?.[0] ?? { row_count: 0, total_amount: 0 };
  return {
    rowCount: Number(row.row_count),
    totalAmount: Number(row.total_amount),
    sameFileImportedAt: same.data?.[0]?.created_at ?? null,
  };
}

// 取り込み本体
// 1. uploads に pending の行を作る
// 2. 明細を 5,000 行ずつ sales に送る(この間は集計に入らない)
// 3. commit_upload で、旧データの削除と有効化をまとめて行う
// 途中で失敗したら、送りかけた行ごと uploads の行を消す(on delete cascade)
export async function importSales(
  fileName: string,
  fileHash: string,
  result: ParseSuccess,
  onProgress: (sent: number) => void,
): Promise<ImportResult> {
  const supabase = createClient();
  const start = performance.now();

  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .insert({
      file_name: fileName,
      file_hash: fileHash,
      period_from: result.periodFrom,
      period_to: result.periodTo,
      row_count: result.rowCount,
      total_amount: result.totalAmount,
      original_row_count: result.rowCount,
      original_total_amount: result.totalAmount,
    })
    .select("id")
    .single();
  if (uploadError) throw uploadError;

  const uploadId: string = upload.id;

  try {
    const chunks: (typeof result.rows)[] = [];
    for (let i = 0; i < result.rows.length; i += CHUNK_SIZE) {
      chunks.push(result.rows.slice(i, i + CHUNK_SIZE));
    }

    // CONCURRENCY 個ずつ並べて送る(順番待ちの仕組み)
    let next = 0;
    let sent = 0;
    async function worker() {
      while (next < chunks.length) {
        const chunk = chunks[next++];
        const { error } = await supabase
          .from("sales")
          .insert(chunk.map((r) => ({ ...r, upload_id: uploadId })));
        if (error) throw error;
        sent += chunk.length;
        onProgress(sent);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker),
    );

    const { data, error } = await supabase.rpc("commit_upload", {
      p_upload_id: uploadId,
    });
    if (error) throw error;

    const row = data?.[0] ?? { replaced_rows: 0, replaced_amount: 0 };
    return {
      replacedRows: Number(row.replaced_rows),
      replacedAmount: Number(row.replaced_amount),
      ms: performance.now() - start,
    };
  } catch (e) {
    // 送りかけた行を消す(pending のままなので、集計には入っていない)
    await supabase.from("uploads").delete().eq("id", uploadId);
    throw e;
  }
}
