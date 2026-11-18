// サーバー(Server Component・Route Handler)で使うSupabaseクライアント
// ログイン情報はCookieから読み取る
import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // supabase-js は、ログイン情報の期限切れを判定するために現在時刻(Date.now)を使う。
  // Cache Components では、毎回変わる値を読む前に io() を呼び、
  // 「ここから先はリクエストのたびに実行する」ことを Next.js に伝える
  await io();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Componentから呼ばれた場合はCookieを書き換えられない。
            // proxy.ts がログイン状態を更新しているので、無視してよい
          }
        },
      },
    },
  );
}
