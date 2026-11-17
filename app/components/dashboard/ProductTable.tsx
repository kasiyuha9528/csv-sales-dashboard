import type { ProductRow } from "@/lib/dashboard/fetchDashboard";
import { toneClass, yen, yoyView } from "@/lib/dashboard/format";

export default function ProductTable({
  rows,
  total,
}: {
  rows: ProductRow[];
  total: number; // 構成比の分母(当期の売上合計)
}) {
  const max = Math.max(1, ...rows.map((r) => r.current));

  return (
    <section
      aria-label="商品別売上"
      className="rounded-xl border border-[#E2E5EA] bg-white px-6 py-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">商品別売上</h2>
        <p className="text-xs text-[#5B6270]">{rows.length} 商品・当期売上の多い順</p>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#5B6270]">
          この条件に該当する売上はありません
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#ECEEF1] text-left text-xs text-[#5B6270]">
                <th className="py-2 pr-3 font-normal">商品名</th>
                <th className="py-2 pr-3 font-normal">カテゴリ</th>
                <th className="w-[28%] py-2 pr-3 font-normal">
                  <span className="sr-only">当期売上の棒</span>
                </th>
                <th className="py-2 pr-3 text-right font-normal">当期</th>
                <th className="py-2 pr-3 text-right font-normal">構成比</th>
                <th className="py-2 pr-3 text-right font-normal">前年同期</th>
                <th className="py-2 text-right font-normal">前年比</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const yoy = yoyView(r.yoy);
                return (
                  <tr key={r.productName} className="border-b border-[#F4F5F7]">
                    <td className="py-2.5 pr-3 font-medium">{r.productName}</td>
                    <td className="py-2.5 pr-3 text-[#5B6270]">{r.category}</td>
                    <td className="py-2.5 pr-3">
                      <div className="h-3 overflow-hidden rounded bg-[#EEF0F3]">
                        <div
                          className="h-full rounded bg-[#2F5BD3]"
                          style={{ width: `${(r.current / max) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{yen(r.current)}</td>
                    <td className="py-2.5 pr-3 text-right text-[#5B6270]">
                      {total > 0 ? `${((r.current / total) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[#5B6270]">{yen(r.previous)}</td>
                    <td className={`py-2.5 text-right font-bold ${toneClass[yoy.tone]}`}>
                      {yoy.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
