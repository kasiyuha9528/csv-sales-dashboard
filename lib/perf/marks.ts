// 性能の計測用(Step 10)
// 「計測の開始」をブラウザ(sessionStorage)に記録しておき、
// ダッシュボードの表示が終わった時点で経過時間を計算する
//
// 計測は、開発中(npm run dev)か、環境変数 NEXT_PUBLIC_SHOW_PERF=true で
// ビルドしたときだけ動く(本番では表示しない)

export type PerfKind = "import" | "filter";

export const PERF_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_SHOW_PERF === "true";

const KEY = "perf-mark";
const MAX_AGE = 60_000; // これより古い開始の記録は使わない(ミリ秒)

// 計測を始める(取り込み完了画面のボタン、絞り込みの変更で呼ぶ)
export function markStart(kind: PerfKind) {
  if (!PERF_ENABLED) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ kind, at: Date.now() }));
  } catch {
    // プライベートモードなどで保存できなくても、アプリの動作には影響させない
  }
}

// 計測を終える。開始の記録がない・古すぎるときは null
export function markEnd(): { kind: PerfKind; ms: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { kind, at } = JSON.parse(raw) as { kind: PerfKind; at: number };
    const ms = Date.now() - at;
    return ms <= MAX_AGE ? { kind, ms } : null;
  } catch {
    return null;
  }
}
