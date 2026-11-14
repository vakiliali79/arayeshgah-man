import "server-only";

import { db } from "@/db";
import { createAuth, type Auth } from "./better-auth";

const globalForAuth = globalThis as unknown as { __arayeshgahAuth?: Auth };

/**
 * نمونه یکتای Better Auth برای برنامه (route handler، server actions، server components).
 * تنظیمات OTP از env خوانده می‌شود (AUTH_OTP_MODE …)؛ تنظیمات نامعتبر هنگام راه‌اندازی متوقف می‌شود.
 */
function build(): Auth {
  // هنگام `next build` تنظیمات production در دسترس نیست و هیچ OTP ارسال نمی‌شود
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return createAuth(db, { otp: { mode: "static", code: "0000", allowedIps: ["build-only"] } });
  }
  return createAuth(db);
}

export const auth: Auth = globalForAuth.__arayeshgahAuth ?? build();
if (process.env.NODE_ENV !== "production") globalForAuth.__arayeshgahAuth = auth;
