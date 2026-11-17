import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .env.local などを読み込む(Supabase のURL・キー・テスト用ユーザー)
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 30_000,
  },
});
