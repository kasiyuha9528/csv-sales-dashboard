// ダッシュボードに必要なデータを、集計RPCからまとめて取る(サーバーで実行)
import { createClient } from "@/lib/supabase/server";

export type DashboardFilter = {
  from: string; // 開始月 "2025-11-01"
  to: string; // 終了月 "2026-10-01"
  categories: string[]; // 空なら「すべて」
  reps: string[]; // 空なら「すべて」
};

export type Kpi = { current: number; previous: number; yoy: number | null };
export type MonthlyRow = { month: string; current: number; previous: number };
export type ProductRow = {
  productName: string;
  category: string;
  current: number;
  previous: number;
  yoy: number | null;
};

const num = (v: unknown) => Number(v ?? 0);
const yoy = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// 絞り込みの選択肢と、最終取り込み
export async function fetchOptions() {
  const supabase = await createClient();
  const [options, latest] = await Promise.all([
    supabase.rpc("get_filter_options"),
    supabase
      .from("uploads")
      .select("file_name, created_at, original_row_count")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (options.error) throw options.error;
  if (latest.error) throw latest.error;

  const o = options.data?.[0];
  return {
    minMonth: (o?.min_month as string | null) ?? null,
    maxMonth: (o?.max_month as string | null) ?? null,
    categories: (o?.categories as string[] | null) ?? [],
    reps: (o?.reps as string[] | null) ?? [],
    latest: latest.data?.[0] ?? null,
  };
}

// KPI・月次推移・商品別を、同時に取る
export async function fetchDashboard(f: DashboardFilter) {
  const supabase = await createClient();
  const params = {
    p_from_month: f.from,
    p_to_month: f.to,
    p_categories: f.categories.length > 0 ? f.categories : null,
    p_reps: f.reps.length > 0 ? f.reps : null,
  };

  const [kpi, monthly, products] = await Promise.all([
    supabase.rpc("get_kpi_summary", params),
    supabase.rpc("get_monthly_sales", params),
    supabase.rpc("get_product_sales", params),
  ]);
  if (kpi.error) throw kpi.error;
  if (monthly.error) throw monthly.error;
  if (products.error) throw products.error;

  const k = kpi.data?.[0];
  return {
    kpi: {
      current: num(k?.current_amount),
      previous: num(k?.previous_amount),
      yoy: yoy(k?.yoy_pct),
    } satisfies Kpi,
    monthly: (monthly.data ?? []).map(
      (r: Record<string, unknown>): MonthlyRow => ({
        month: String(r.month),
        current: num(r.current_amount),
        previous: num(r.previous_amount),
      }),
    ),
    products: (products.data ?? []).map(
      (r: Record<string, unknown>): ProductRow => ({
        productName: String(r.product_name),
        category: String(r.category),
        current: num(r.current_amount),
        previous: num(r.previous_amount),
        yoy: yoy(r.yoy_pct),
      }),
    ),
  };
}
