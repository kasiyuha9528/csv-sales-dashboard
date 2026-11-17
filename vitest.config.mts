import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Next.js と同じく、"@/lib/..." をプロジェクト直下からの指定として読む
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // .env.local などを読み込む(Supabase のURL・キー・テスト用ユーザー)
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 30_000,
  },
});
