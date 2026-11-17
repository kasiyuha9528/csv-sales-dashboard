// 画面に出す数字の形
export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

// グラフの目盛り用:1,234,567 → "123万"
export const man = (n: number) =>
  `${(n / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万`;

// 前年比:+3.2 → { text: "▲ 3.2%", tone: "up" } / null → { text: "—", tone: "none" }
export function yoyView(yoy: number | null) {
  if (yoy === null) return { text: "—", tone: "none" as const };
  if (yoy >= 0) return { text: `▲ ${yoy.toFixed(1)}%`, tone: "up" as const };
  return { text: `▼ ${Math.abs(yoy).toFixed(1)}%`, tone: "down" as const };
}

export const toneClass = {
  up: "text-[#1B7F4B]",
  down: "text-[#B4410C]",
  none: "text-[#5B6270]",
} as const;
