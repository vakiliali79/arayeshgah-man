import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db/client";
import { files, portfolioItems, services, stylists } from "@/db/schema";
import { isAdmin, type Actor } from "../auth/actor";
import { assertSalonPermission, getStylistByUserId } from "../auth/permissions";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors";
import type { FileServiceDeps } from "../storage/file-service";
import { uploadFile } from "../storage/file-service";
import { parseInput } from "../validation";

const metaSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(500).optional(),
    serviceId: z.uuid().optional(),
    /** نمونه‌کار سالن (نیازمند manage_portfolio)؛ در غیر این صورت نمونه‌کار خود آرایشگر */
    salonId: z.uuid().optional(),
  })
  .strict();

/** آپلود تصویر + ثبت نمونه‌کار؛ در صورت شکست ثبت، فایل پاک می‌شود */
export async function createPortfolioItem(deps: FileServiceDeps, actor: Actor, data: Uint8Array, meta: unknown, originalName?: string) {
  const m = parseInput(metaSchema, meta);
  let stylistId: string | null = null;
  if (m.salonId) {
    await assertSalonPermission(deps.db, actor, m.salonId, "manage_portfolio");
  } else {
    const stylist = await getStylistByUserId(deps.db, actor.userId);
    if (!stylist) throw new BusinessRuleError("PROFILE_REQUIRED", "Stylist profile required");
    stylistId = stylist.id;
  }
  if (m.serviceId) {
    const [svc] = await deps.db.select().from(services).where(eq(services.id, m.serviceId)).limit(1);
    if (!svc) throw new NotFoundError("Service");
  }
  const file = await uploadFile(deps, actor, data, { purpose: "portfolio", salonId: m.salonId, originalName });
  try {
    const [item] = await deps.db
      .insert(portfolioItems)
      .values({ stylistId, salonId: m.salonId ?? null, serviceId: m.serviceId ?? null, fileId: file.id, title: m.title, description: m.description, createdBy: actor.userId })
      .returning();
    return item!;
  } catch (err) {
    await deps.db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, file.id));
    await deps.storage.delete(file.storageKey).catch(() => {});
    throw err;
  }
}

/** حذف نمونه‌کار و تصویر آن (آرایشگر صاحب، دارنده manage_portfolio سالن، یا ادمین) */
export async function deletePortfolioItem(deps: FileServiceDeps, actor: Actor, itemId: string) {
  const key = await deps.db.transaction(async (tx) => {
    const [item] = await tx.select().from(portfolioItems).where(eq(portfolioItems.id, itemId)).for("update").limit(1);
    if (!item) throw new NotFoundError("Portfolio item");
    let allowed = isAdmin(actor);
    if (!allowed && item.stylistId) {
      const [st] = await tx.select({ userId: stylists.userId }).from(stylists).where(eq(stylists.id, item.stylistId)).limit(1);
      allowed = st?.userId === actor.userId;
    }
    if (!allowed && item.salonId) {
      await assertSalonPermission(tx, actor, item.salonId, "manage_portfolio");
      allowed = true;
    }
    if (!allowed) throw new ForbiddenError();
    await tx.delete(portfolioItems).where(eq(portfolioItems.id, itemId));
    const [file] = await tx.update(files).set({ deletedAt: new Date() }).where(and(eq(files.id, item.fileId), isNull(files.deletedAt))).returning();
    return file?.storageKey ?? null;
  });
  if (key) await deps.storage.delete(key).catch(() => {});
}

export async function listPortfolio(db: DbOrTx, target: { stylistId?: string; salonId?: string }, publishedOnly = true) {
  const cond = [target.stylistId ? eq(portfolioItems.stylistId, target.stylistId) : eq(portfolioItems.salonId, target.salonId!)];
  if (publishedOnly) cond.push(eq(portfolioItems.isPublished, true));
  return db
    .select({ id: portfolioItems.id, title: portfolioItems.title, description: portfolioItems.description, fileId: portfolioItems.fileId, createdAt: portfolioItems.createdAt })
    .from(portfolioItems)
    .where(and(...cond))
    .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt))
    .limit(60);
}
