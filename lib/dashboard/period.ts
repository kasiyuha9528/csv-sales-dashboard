// 月("2025-11-01" の形)の計算と表示

// "2025-11-01" に n か月を足す
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const mon = (total % 12) + 1;
  return `${year}-${String(mon).padStart(2, "0")}-01`;
}

// "2025-11-01" → "2025/11"
export const monthLabel = (month: string) => month.slice(0, 7).replace("-", "/");

// "2025-11-01" → "11月"
export const monthShort = (month: string) => `${Number(month.slice(5, 7))}月`;

// 初期表示:データの最後の月から直近12か月(データが12か月より短ければ最初の月から)
export function defaultPeriod(minMonth: string, maxMonth: string) {
  const from = addMonths(maxMonth, -11);
  return { from: from < minMonth ? minMonth : from, to: maxMonth };
}
