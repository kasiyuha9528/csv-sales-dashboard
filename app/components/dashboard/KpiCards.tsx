import type { Kpi } from "@/lib/dashboard/fetchDashboard";
import { toneClass, yen, yoyView } from "@/lib/dashboard/format";

export default function KpiCards({
  kpi,
  conditionLabel,
}: {
  kpi: Kpi;
  conditionLabel: string;
}) {
  const yoy = yoyView(kpi.yoy);
  const diff = kpi.current - kpi.previous;

  return (
    <section aria-label="KPI" className="flex flex-wrap gap-4">
      <div className="min-w-0 flex-[1_1_320px] rounded-xl border border-[#E2E5EA] bg-white px-6 py-5">
        <p className="text-sm font-medium text-[#5B6270]">売上合計</p>
        <p className="mt-2 text-[34px] font-bold tracking-tight">{yen(kpi.current)}</p>
        <p className="mt-1.5 text-sm text-[#5B6270]">{conditionLabel}</p>
      </div>
      <div className="min-w-0 flex-[1_1_320px] rounded-xl border border-[#E2E5EA] bg-white px-6 py-5">
        <p className="text-sm font-medium text-[#5B6270]">前年同期比</p>
        <p className={`mt-2 text-[34px] font-bold ${toneClass[yoy.tone]}`}>{yoy.text}</p>
        <p className="mt-1.5 text-sm text-[#5B6270]">
          前年同期 {yen(kpi.previous)}(差額 {diff >= 0 ? "+" : "−"}
          {yen(Math.abs(diff))})
        </p>
      </div>
    </section>
  );
}
