import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { getTestDatabaseUrl } from "../helpers/env";

export const E2E_PORT = 3210;
let server: ChildProcess | undefined;
let outbox: string | undefined;

/**
 * سرور production (`next start`) را روی دیتابیس تست اجرا می‌کند.
 * ایمیل‌ها در یک پوشه موقت (outbox) نوشته می‌شوند تا تست لینک‌ها را بخواند.
 */
export default async function setup(project: TestProject) {
  outbox = await mkdtemp(path.join(os.tmpdir(), "arayeshgah-e2e-mail-"));
  project.provide("outbox", outbox);
  project.provide("baseURL", `http://localhost:${E2E_PORT}`);

  server = spawn("npx", ["next", "start", "-p", String(E2E_PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: getTestDatabaseUrl(),
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
      MAIL_TRANSPORT: "file",
      MAIL_ALLOW_FILE_IN_PRODUCTION: "1",
      MAIL_OUTBOX_DIR: outbox,
      UPLOAD_DIR: path.join(outbox, "uploads"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // گروه پردازش جدا تا next-server (فرزند npx) هم بسته شود
  });
  server.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${E2E_PORT}/`);
      if (res.ok) break;
    } catch {
      // هنوز بالا نیامده
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return async () => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // قبلاً بسته شده
      }
    }
    if (outbox) await rm(outbox, { recursive: true, force: true });
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    outbox: string;
    baseURL: string;
  }
}
