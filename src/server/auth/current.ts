import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROUTES } from "@/config/routes";
import { db } from "@/db";
import type { UserRole } from "@/db/types";
import { auth } from ".";
import { getSessionContext, hasRole, type SessionContext } from "./session";

/** نشست جاری (یک‌بار در هر درخواست) */
export const getCurrentSession = cache(async (): Promise<SessionContext | null> => {
  return getSessionContext(auth, db, await headers());
});

/**
 * محافظ سمت سرور برای صفحات و Server Actionها.
 * proxy فقط وجود کوکی را بررسی می‌کند؛ اعتبار واقعی نشست و نقش همین‌جا بررسی می‌شود.
 */
export async function requireSession(allowedRoles?: readonly UserRole[]): Promise<SessionContext> {
  const ctx = await getCurrentSession();
  if (!ctx) {
    // کوکی هست ولی نشست نامعتبر/منقضی است ← ورود دوباره با پیام و بازگشت به همین صفحه
    const h = await headers();
    const q = new URLSearchParams();
    const path = h.get("x-request-path");
    if (path && path.startsWith("/dashboard") && !path.startsWith("//")) q.set("next", path);
    if (/(^|;\s*)(__Secure-)?arayeshgah\.session_token=/.test(h.get("cookie") ?? "")) q.set("notice", "session_expired");
    redirect(q.size ? `${ROUTES.login}?${q}` : ROUTES.login);
  }
  if (allowedRoles && !hasRole(ctx, allowedRoles)) redirect(`${ROUTES.dashboard}?error=forbidden`);
  return ctx;
}
