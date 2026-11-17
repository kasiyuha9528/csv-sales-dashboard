// 全画面共通のヘッダー(ログイン中のメールアドレス・メニュー・ログアウト)
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/components/LogoutButton";

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/upload", label: "CSV取り込み" },
  { href: "/uploads", label: "取り込み履歴" },
] as const;

export default async function AppHeader({ current }: { current: string }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  return (
    <header className="border-b border-[#E2E5EA] bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-8">
        <div className="flex flex-wrap items-center gap-8">
          <p className="text-lg font-bold">売上ダッシュボード</p>
          <nav aria-label="メイン" className="flex gap-1 text-sm">
            {NAV.map((item) =>
              item.href === current ? (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current="page"
                  className="rounded-lg bg-[#EEF2FC] px-3.5 py-2.5 font-bold text-[#1F3F9E]"
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3.5 py-2.5 text-[#3D434D]"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#5B6270]">
          <span>{email}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
