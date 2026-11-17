// 取り込み履歴
// cacheComponents が有効なので、データを読む部分(UploadList)を <Suspense> で囲む
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/app/components/AppHeader";
import DeleteUploadButton from "./DeleteUploadButton";

type Upload = {
  id: string;
  created_at: string;
  file_name: string;
  period_from: string;
  period_to: string;
  row_count: number;
  total_amount: number;
  original_row_count: number;
  original_total_amount: number;
  status: "pending" | "active" | "replaced";
  uploader_email: string | null;
};

const yen = (n: number) => `¥${Number(n).toLocaleString("ja-JP")}`;
const num = (n: number) => Number(n).toLocaleString("ja-JP");
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// 状態の表示(案A:行が減った有効な取り込みは「一部置換」)
function statusOf(u: Upload) {
  if (u.status === "pending")
    return { label: "取り込み中", className: "bg-[#FFF8EC] text-[#7A4A06]" };
  if (u.status === "replaced")
    return { label: "置換済み", className: "bg-[#EEF0F3] text-[#3D434D]" };
  if (u.row_count < u.original_row_count)
    return { label: "一部置換", className: "bg-[#EEF2FC] text-[#1F3F9E]" };
  return { label: "有効", className: "bg-[#E6F4EC] text-[#145C37]" };
}

export default function UploadsPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1D21]">
      <AppHeader current="/uploads" />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">取り込み履歴</h1>
            <p className="mt-1.5 text-sm text-[#5B6270]">
              誤って取り込んだ場合は、履歴ごと削除すると集計から外れます。
            </p>
          </div>
          <Link
            href="/upload"
            className="rounded-lg bg-[#2F5BD3] px-5 py-3 text-sm font-bold text-white"
          >
            CSVを取り込む
          </Link>
        </div>

        <Suspense
          fallback={
            <div
              aria-busy="true"
              aria-label="読み込み中"
              className="h-64 animate-pulse rounded-xl bg-white"
            />
          }
        >
          <UploadList />
        </Suspense>
      </main>
    </div>
  );
}

async function UploadList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("uploads")
    .select(
      "id, created_at, file_name, period_from, period_to, row_count, total_amount, original_row_count, original_total_amount, status, uploader_email",
    )
    .order("created_at", { ascending: false });

  const uploads = (data ?? []) as Upload[];

  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-[#FDF0EA] px-4 py-3 text-sm text-[#8A2F08]"
        >
          データを読み込めませんでした。時間をおいて再読み込みしてください
        </p>
      )}

      <section
        aria-label="履歴一覧"
        className="rounded-xl border border-[#E2E5EA] bg-white px-5 py-2"
      >
        {uploads.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#5B6270]">
            まだ取り込みはありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E5EA] text-left text-[#5B6270]">
                  <th className="px-2 py-3 font-semibold">取り込み日時</th>
                  <th className="px-2 py-3 font-semibold">ファイル名</th>
                  <th className="px-2 py-3 font-semibold">対象期間</th>
                  <th className="px-2 py-3 text-right font-semibold">行数</th>
                  <th className="px-2 py-3 text-right font-semibold">合計金額</th>
                  <th className="px-2 py-3 font-semibold">状態</th>
                  <th className="px-2 py-3 font-semibold">取り込んだ人</th>
                  <th className="px-2 py-3">
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => {
                  const s = statusOf(u);
                  const changed = u.row_count !== u.original_row_count;
                  return (
                    <tr key={u.id} className="border-b border-[#F0F1F4] align-top">
                      <td className="px-2 py-3 whitespace-nowrap">{dateTime(u.created_at)}</td>
                      <td className="px-2 py-3 font-medium">{u.file_name}</td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {u.period_from} 〜 {u.period_to}
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        {num(u.row_count)}
                        {changed && (
                          <span className="block text-xs text-[#5B6270]">
                            取り込み時 {num(u.original_row_count)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        {yen(u.total_amount)}
                        {changed && (
                          <span className="block text-xs text-[#5B6270]">
                            取り込み時 {yen(u.original_total_amount)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.className}`}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-[#3D434D]">{u.uploader_email ?? "—"}</td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <DeleteUploadButton id={u.id} fileName={u.file_name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
