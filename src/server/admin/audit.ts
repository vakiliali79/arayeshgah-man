import { and, count, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { adminAuditLogs, profiles, users } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { ForbiddenError } from "../errors";

export function assertAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new ForbiddenError();
}

export type AuditTarget = "user" | "salon" | "stylist" | "booking" | "review" | "ticket" | "category" | "plan" | "setting";
export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export interface AuditInput {
  /** «موضوع.عمل»، مثل salon.approve */
  action: `${AuditTarget}.${string}`;
  targetType: AuditTarget;
  targetId: string;
  summary?: string;
  reason?: string | null;
  changes?: AuditChanges;
}

/** ثبت اقدام مدیریتی؛ باید داخل همان تراکنشِ تغییر صدا زده شود تا یا هر دو ثبت شوند یا هیچ‌کدام */
export async function recordAudit(db: DbOrTx, actor: Actor, a: AuditInput) {
  await db.insert(adminAuditLogs).values({
    actorId: actor.userId,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    summary: a.summary ?? null,
    reason: a.reason?.trim() || null,
    changes: a.changes ?? {},
  });
}

const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);

/** تفاوت فیلدهای تغییرکرده (فقط کلیدهای داده‌شده در patch) */
export function diffFields(before: Record<string, unknown>, patch: Record<string, unknown>): AuditChanges {
  const out: AuditChanges = {};
  for (const [k, to] of Object.entries(patch)) {
    if (to === undefined) continue;
    const from = before[k];
    if (JSON.stringify(norm(from)) !== JSON.stringify(norm(to))) out[k] = { from: norm(from), to: norm(to) };
  }
  return out;
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditLogs(db: DbOrTx, actor: Actor, filter: { targetType?: string; targetId?: string; action?: string; actorId?: string; page?: number } = {}) {
  assertAdmin(actor);
  const cond = [];
  if (filter.targetType) cond.push(eq(adminAuditLogs.targetType, filter.targetType));
  if (filter.targetId) cond.push(eq(adminAuditLogs.targetId, filter.targetId));
  if (filter.action && /^[a-z_]+(\.[a-z_]+)?$/.test(filter.action)) {
    cond.push(filter.action.includes(".") ? eq(adminAuditLogs.action, filter.action) : sql`${adminAuditLogs.action} like ${`${filter.action}.%`}`);
  }
  if (filter.actorId) cond.push(eq(adminAuditLogs.actorId, filter.actorId));
  const where = cond.length ? and(...cond) : undefined;
  const page = Math.max(1, filter.page ?? 1);
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        summary: adminAuditLogs.summary,
        reason: adminAuditLogs.reason,
        changes: adminAuditLogs.changes,
        createdAt: adminAuditLogs.createdAt,
        actorId: adminAuditLogs.actorId,
        actorName: sql<string | null>`coalesce(${profiles.fullName}, ${users.name})`,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(users.id, adminAuditLogs.actorId))
      .leftJoin(profiles, eq(profiles.userId, adminAuditLogs.actorId))
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: count() }).from(adminAuditLogs).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

/** تاریخچه یک موجودیت (برای صفحات جزئیات) */
export async function historyFor(db: DbOrTx, actor: Actor, targetType: AuditTarget, targetId: string) {
  return (await listAuditLogs(db, actor, { targetType, targetId })).rows;
}
