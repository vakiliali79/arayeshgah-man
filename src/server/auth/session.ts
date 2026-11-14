import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { profiles } from "@/db/schema";
import type { Profile, UserRole } from "@/db/types";
import { ensureProfile } from "../profiles/service";
import type { Actor } from "./actor";
import type { Auth } from "./better-auth";

export interface SessionContext {
  user: { id: string; name: string; email: string; emailVerified: boolean };
  session: { id: string; expiresAt: Date };
  profile: Profile;
  /** نقش از جدول profiles (دیتابیس) — هرگز از کوکی یا کلاینت */
  actor: Actor;
}

/**
 * نشست معتبر + پروفایل از روی هدرهای درخواست.
 * اعتبار نشست توسط Better Auth با جدول sessions بررسی می‌شود. اگر به هر دلیل پروفایل
 * وجود نداشته باشد (مثلاً شکست hook)، اینجا ساخته می‌شود.
 */
export async function getSessionContext(auth: Auth, db: DbOrTx, headers: Headers): Promise<SessionContext | null> {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;
  const { user, session } = result;

  let [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!profile) {
    await ensureProfile(db, { userId: user.id, fullName: user.name });
    [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  }
  if (!profile) return null;

  return {
    user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
    session: { id: session.id, expiresAt: session.expiresAt },
    profile,
    actor: { userId: user.id, role: profile.role },
  };
}

export function hasRole(ctx: SessionContext, roles: readonly UserRole[]) {
  return roles.includes(ctx.profile.role);
}
