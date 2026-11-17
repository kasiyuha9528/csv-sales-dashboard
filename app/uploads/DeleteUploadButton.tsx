"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 取り込みを履歴ごと削除する(明細は on delete cascade で一緒に消える)
export default function DeleteUploadButton({
  id,
  fileName,
}: {
  id: string;
  fileName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("uploads").delete().eq("id", id);
    setBusy(false);
    if (error) {
      console.error(error);
      setError("削除できませんでした。時間をおいてお試しください");
      return;
    }
    setConfirming(false);
    router.refresh(); // 一覧を取り直す
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`${fileName} を削除`}
        className="rounded-lg border border-[#E2B9A6] px-3 py-2 text-[#A13A0B]"
      >
        削除
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="max-w-56 text-left text-xs leading-relaxed whitespace-normal text-[#3D434D]">
        集計から外します。この取り込みで置き換えた古いデータは元に戻りません。
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-lg bg-[#B4410C] px-3 py-2 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "削除中…" : "削除する"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-lg px-3 py-2 text-[#3D434D]"
        >
          戻る
        </button>
      </div>
      {error && <p className="text-xs text-[#B4410C]">{error}</p>}
    </div>
  );
}
