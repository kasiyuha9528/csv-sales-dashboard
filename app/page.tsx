// ダッシュボード
// cacheComponents が有効なので、データを読む部分(Dashboard)を <Suspense> で囲む。
// 見出しなどの外枠は先に表示され、集計はあとから流れ込む
import { Suspense } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import ReloadButton from "@/app/components/ReloadButton";
import KpiCards from "@/app/components/dashboard/KpiCards";
import MonthlyChart from "@/app/components/dashboard/MonthlyChart";
import ProductTable from "@/app/components/dashboard/ProductTable";
import {
  fetchDashboard,
  fetchOptions,
  type DashboardFilter,
} from "@/lib/dashboard/fetchDashboard";
import { defaultPeriod, monthLabel } from "@/lib/dashboard/period";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1D21] tabular-nums">
      <AppHeader current="/" />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-7">
        <h1 className="text-2xl font-bold">売上サマリー</h1>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </main>
    </div>
  );
}

async function Dashboard() {
  let options;
  try {
    options = await fetchOptions();
  } catch (e) {
    // Next.js が内部で使う合図(ビルド時の Cookie 読み取りの中断など)は受け止めずに投げ直す
    unstable_rethrow(e);
    console.error(e);
    return <LoadError />;
  }

  // まだデータがないとき
  if (!options.minMonth || !options.maxMonth) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-xl border border-[#E2E5EA] bg-white px-6 py-14 text-center">
        <p className="font-bold">まだ売上データがありません</p>
        <p className="text-sm text-[#5B6270]">CSVを取り込むと、ここに集計が表示されます。</p>
        <Link
          href="/upload"
          className="rounded-lg bg-[#2F5BD3] px-5 py-3 text-sm font-bold text-white"
        >
          CSVを取り込む
        </Link>
      </section>
    );
  }

  // Step 8 は初期の条件だけ(絞り込みの操作は Step 9 で作る)
  const filter: DashboardFilter = {
    ...defaultPeriod(options.minMonth, options.maxMonth),
    categories: [],
    reps: [],
  };

  let data;
  try {
    data = await fetchDashboard(filter);
  } catch (e) {
    // Next.js が内部で使う合図(ビルド時の Cookie 読み取りの中断など)は受け止めずに投げ直す
    unstable_rethrow(e);
    console.error(e);
    return <LoadError />;
  }

  const conditionLabel = `${monthLabel(filter.from)}〜${monthLabel(filter.to)}・全カテゴリ・全担当者`;

  return (
    <>
      {options.latest && (
        <p className="-mt-3 text-sm text-[#5B6270]">
          最終取り込み:{dateTime(options.latest.created_at)}({options.latest.file_name}
          ・{Number(options.latest.original_row_count).toLocaleString("ja-JP")}
          行)・前年同期=1年前の同じ月
        </p>
      )}
      <KpiCards kpi={data.kpi} conditionLabel={conditionLabel} />
      <MonthlyChart rows={data.monthly} />
      <ProductTable rows={data.products} total={data.kpi.current} />
    </>
  );
}

// 読み込み中の仮の表示
function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="読み込み中" className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        <div className="h-[132px] flex-[1_1_320px] animate-pulse rounded-xl bg-white" />
        <div className="h-[132px] flex-[1_1_320px] animate-pulse rounded-xl bg-white" />
      </div>
      <div className="h-[380px] animate-pulse rounded-xl bg-white" />
      <div className="h-[420px] animate-pulse rounded-xl bg-white" />
    </div>
  );
}

// 集計の読み込みに失敗したとき(要件定義書 5章)
function LoadError() {
  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl bg-[#FDF0EA] px-5 py-4 text-sm text-[#8A2F08]"
    >
      <p>データを読み込めませんでした。時間をおいて再読み込みしてください</p>
      <ReloadButton />
    </section>
  );
}
