// proxy.ts から呼ばれ、リクエストのたびにログイン状態を確認・更新する
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // createServerClient と getClaims の間には処理を書かない(公式の注意)。
  // getClaims はログイン情報(トークン)の署名を検証してから返す
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const path = request.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");

  // 別のページへ移動させる。Supabase が更新した Cookie(無効なログイン情報の削除など)も引き継ぐ
  function redirectTo(pathname: string, reason?: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = reason ? `?reason=${reason}` : "";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }

  // 未ログインで、ログイン画面以外を開こうとした → ログイン画面へ
  if (!user && !isLoginPage) {
    // ログイン情報の Cookie が残っているのに認められない = 期限切れ・無効になった
    // (初めて開いたとき・ログアウト後は Cookie がないので、メッセージは出さない)
    const hadSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
    return redirectTo("/login", hadSession ? "expired" : undefined);
  }

  // ログイン済みで、ログイン画面を開こうとした → ダッシュボードへ
  if (user && isLoginPage) {
    return redirectTo("/");
  }

  // Cookieの更新を反映した supabaseResponse を、そのまま返す
  return supabaseResponse;
}
