import AppHeader from "@/app/components/AppHeader";
import UploadForm from "./UploadForm";

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1D21]">
      <AppHeader current="/upload" />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-8 py-7">
        <div>
          <h1 className="text-2xl font-bold">売上CSVの取り込み</h1>
          <p className="mt-1.5 text-sm text-[#5B6270]">
            同じ期間のデータがすでにある場合は、新しいCSVの内容で置き換えます。
          </p>
        </div>
        <UploadForm />
      </main>
    </div>
  );
}
