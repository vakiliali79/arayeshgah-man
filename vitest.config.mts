import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // ماژول server-only فقط در bundle سرور Next معتبر است؛ در تست‌ها خنثی می‌شود
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // همه فایل‌ها یک دیتابیس تست مشترک دارند
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
