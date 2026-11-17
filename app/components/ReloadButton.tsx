"use client";

// 画面を読み込み直すボタン(データの読み込みに失敗したときに使う)
export default function ReloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-lg border border-[#E2B9A6] bg-white px-4 py-2 font-semibold"
    >
      再読み込み
    </button>
  );
}
