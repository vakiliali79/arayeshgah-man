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
  if (!ctx) redirect(ROUTES.login);
  if (allowedRoles && !hasRole(ctx, allowedRoles)) redirect(`${ROUTES.dashboard}?error=forbidden`);
  return ctx;
}
