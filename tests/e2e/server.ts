import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { getTestDatabaseUrl } from "../helpers/env";

export const E2E_PORT = 3210;
/** IP مجاز حالت آزمایشی؛ مرورگر تست هدر X-Real-IP را مثل nginx می‌فرستد */
export const E2E_ALLOWED_IP = "10.99.0.7";
let server: ChildProcess | undefined;

/**
 * سرور production (`next start`) روی دیتابیس تست، در «حالت آزمایشی کنترل‌شده»:
 * OTP ثابت فقط با فعال‌سازی صریح و فقط برای IP مجاز (X-Real-IP) پذیرفته می‌شود.
 */
export default async function setup(project: TestProject) {
  project.provide("baseURL", `http://localhost:${E2E_PORT}`);
  project.provide("allowedIp", E2E_ALLOWED_IP);

  server = spawn("npx", ["next", "start", "-p", String(E2E_PORT)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: getTestDatabaseUrl(),
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
      AUTH_OTP_MODE: "static",
      AUTH_STATIC_OTP: "1111",
      AUTH_STATIC_OTP_ALLOW_IN_PRODUCTION: "1",
      AUTH_STATIC_OTP_ALLOWED_IPS: E2E_ALLOWED_IP,
      UPLOAD_DIR: path.join(os.tmpdir(), "arayeshgah-e2e-uploads"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // گروه پردازش جدا تا next-server (فرزند npx) هم بسته شود
  });
  server.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));
  if (process.env.E2E_SERVER_LOGS === "1") server.stdout?.on("data", (d) => process.stdout.write(`[next] ${d}`));

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
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
    allowedIp: string;
  }
}
