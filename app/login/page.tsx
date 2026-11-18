"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      // エラー設計:どちらが違うかは出さない/内部の詳細は画面に出さない
      if (error.code === "invalid_credentials") {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else if (error.name === "AuthRetryableFetchError") {
        setError(
          "通信できませんでした。ネットワークの接続を確認して、もう一度お試しください",
        );
      } else {
        console.error(error);
        setError("現在ご利用いただけません。管理者にお問い合わせください");
      }
      return;
    }

    // ログイン成功:ダッシュボードへ移動し、サーバー側の表示も更新する
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] px-5 py-12 text-[#1A1D21]">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-xl font-bold">売上ダッシュボード</p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-[#E2E5EA] bg-white p-8"
        >
          <h1 className="text-xl font-bold">ログイン</h1>

          {/* 期限切れでログイン画面に戻されたときの案内。URLを読むので <Suspense> で囲む */}
          {!error && (
            <Suspense fallback={null}>
              <ExpiredNotice />
            </Suspense>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-[#FDF0EA] px-3 py-2 text-sm text-[#8A2F08]"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-lg border border-[#C9CED6] px-3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-lg border border-[#C9CED6] px-3"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-lg bg-[#2F5BD3] font-bold text-white disabled:opacity-60"
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>

        <p className="text-center text-xs text-[#5B6270]">
          アカウントは管理者が発行します。お困りの場合は管理者へご連絡ください。
        </p>
      </div>
    </main>
  );
}

// /login?reason=expired のときだけ表示する(要件定義書 5章)
function ExpiredNotice() {
  const reason = useSearchParams().get("reason");
  if (reason !== "expired") return null;
  return (
    <p
      role="status"
      className="rounded-lg bg-[#FFF8EC] px-3 py-2 text-sm text-[#7A4A06]"
    >
      ログインの有効期限が切れました。もう一度ログインしてください
    </p>
  );
}
