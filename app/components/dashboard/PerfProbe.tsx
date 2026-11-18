"use client";

import { useEffect, useState } from "react";
import { markEnd, type PerfKind } from "@/lib/perf/marks";

const LABEL: Record<PerfKind, string> = {
  import: "取り込み完了から表示まで",
  filter: "絞り込みの変更から表示まで",
};
const LIMIT: Record<PerfKind, number> = { import: 5000, filter: 1000 }; // 目標(ミリ秒)

// ダッシュボードの集計が画面に出たら、計測の開始からの経過時間を表示する(Step 10)
// 集計が変わるたびに作り直されるよう、ページ側で key を付けて置く
export default function PerfProbe() {
  const [result, setResult] = useState<{ kind: PerfKind; ms: number } | null>(null);

  useEffect(() => {
    // 描画が画面に反映されてから測る(2回目のフレームの時点)
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        const r = markEnd();
        if (!r) return;
        console.log(`[性能] ${LABEL[r.kind]} ${(r.ms / 1000).toFixed(2)} 秒`);
        setResult(r);
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!result) return null;
  const ok = result.ms <= LIMIT[result.kind];

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg bg-[#1A1D21] px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>
        {LABEL[result.kind]} <strong>{(result.ms / 1000).toFixed(2)} 秒</strong>
        <span className={ok ? "ml-2 text-[#7FD6A4]" : "ml-2 text-[#F4A97A]"}>
          (目標 {LIMIT[result.kind] / 1000} 秒以内:{ok ? "OK" : "超過"})
        </span>
      </span>
      <button
        type="button"
        onClick={() => setResult(null)}
        aria-label="計測結果を閉じる"
        className="rounded px-1.5 text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
