// ダッシュボード(Step 8で本実装。今はログインの確認用)
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/app/components/AppHeader";

export default async function Home() {
  const supabase = await createClient();

  // ログイン済みでテーブルを読めるかの確認(件数だけ取得)
  const { count, error } = await supabase
    .from("uploads")
    .select("*", { count: "exact", head: true });

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1D21]">
      <AppHeader current="/" />

      <main className="mx-auto max-w-7xl px-8 py-7">
        <h1 className="text-2xl font-bold">売上サマリー</h1>
        <p className="mt-2 text-sm text-[#5B6270]">
          ダッシュボードはStep 8で作成します。
        </p>

        <section className="mt-6 rounded-xl border border-[#E2E5EA] bg-white p-6 text-sm">
          <h2 className="font-bold">Step 3 の確認</h2>
          {error ? (
            <p className="mt-2 text-[#B4410C]">
              uploads を読めませんでした:{error.message}
            </p>
          ) : (
            <p className="mt-2">
              uploads を読めました(現在 {count ?? 0} 件)
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
