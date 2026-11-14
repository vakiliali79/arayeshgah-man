import path from "node:path";
import { defineConfig } from "vitest/config";

/** تست end-to-end روی بیلد production واقعی (ابتدا `npm run build`) */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts"],
    globalSetup: ["tests/global-setup.ts", "tests/e2e/server.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
