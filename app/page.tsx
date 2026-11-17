// ダッシュボード(Step 8で本実装。Step 3ではログインの確認用)
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/components/LogoutButton";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  // ログイン済みでテーブルを読めるかの確認(件数だけ取得)
  const { count, error } = await supabase
    .from("uploads")
    .select("*", { count: "exact", head: true });

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1D21]">
      <header className="border-b border-[#E2E5EA] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-8">
          <p className="text-lg font-bold">売上ダッシュボード</p>
          <div className="flex items-center gap-4 text-sm text-[#5B6270]">
            <span>{email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

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
