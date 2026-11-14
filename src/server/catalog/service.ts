import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { serviceCategories, services, stylistServices, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { assertSalonPermission, isActiveSalonStylist } from "../auth/permissions";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors";
import { isAdmin } from "../auth/actor";
import { parseInput } from "../validation";

const duration = z.number().int().min(5).max(720).multipleOf(5);
const price = z.number().int().min(0).max(1_000_000_000);
export const CATEGORY_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;
const categoryKey = z.string().trim().regex(CATEGORY_KEY_RE);

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** دسته‌بندی باید وجود داشته و فعال باشد (دسته‌بندی غیرفعال برای خدمت جدید/تغییر قابل انتخاب نیست) */
async function assertActiveCategory(tx: Tx, key: string | undefined) {
  if (!key) return;
  const [c] = await tx.select({ isActive: serviceCategories.isActive }).from(serviceCategories).where(eq(serviceCategories.key, key)).limit(1);
  if (!c || !c.isActive) throw new BusinessRuleError("CATEGORY_UNAVAILABLE", "Category does not exist or is inactive");
}

const createServiceSchema = z
  .object({
    salonId: z.uuid().optional(),
    stylistId: z.uuid().optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    category: categoryKey,
    durationMinutes: duration,
    bufferMinutes: z.number().int().min(0).max(120).default(0),
    priceToman: price,
  })
  .refine((v) => Boolean(v.salonId) !== Boolean(v.stylistId), "Exactly one of salonId or stylistId is required");

/** ایجاد خدمت: سالن (نیازمند manage_services) یا آرایشگر مستقل (فقط خود آرایشگر) */
export async function createService(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(createServiceSchema, input);
  return db.transaction(async (tx) => {
    if (data.salonId) {
      await assertSalonPermission(tx, actor, data.salonId, "manage_services");
    } else {
      const [stylist] = await tx.select().from(stylists).where(eq(stylists.id, data.stylistId!)).limit(1);
      if (!stylist) throw new NotFoundError("Stylist");
      if (stylist.userId !== actor.userId && !isAdmin(actor)) throw new ForbiddenError();
    }
    await assertActiveCategory(tx, data.category);
    const [row] = await tx.insert(services).values(data).returning();
    return row!;
  });
}

const assignSchema = z.object({
  stylistId: z.uuid(),
  serviceId: z.uuid(),
  customPriceToman: price.optional(),
  customDurationMinutes: duration.optional(),
});

/**
 * تخصیص خدمت به آرایشگر.
 *  - خدمت سالن: کاربر manage_services داشته باشد و آرایشگر عضو فعال همان سالن باشد.
 *  - خدمت مستقل: فقط به همان آرایشگر صاحب خدمت.
 */
export async function assignServiceToStylist(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(assignSchema, input);
  return db.transaction(async (tx) => {
    const [service] = await tx.select().from(services).where(eq(services.id, data.serviceId)).limit(1);
    if (!service) throw new NotFoundError("Service");
    const [stylist] = await tx.select().from(stylists).where(eq(stylists.id, data.stylistId)).limit(1);
    if (!stylist) throw new NotFoundError("Stylist");

    if (service.salonId) {
      await assertSalonPermission(tx, actor, service.salonId, "manage_services");
      if (!(await isActiveSalonStylist(tx, service.salonId, stylist.userId))) {
        throw new BusinessRuleError("STYLIST_NOT_IN_SALON", "Stylist is not an active member of this salon");
      }
    } else {
      if (service.stylistId !== stylist.id) throw new BusinessRuleError("SERVICE_OWNER_MISMATCH", "Independent service belongs to another stylist");
      if (stylist.userId !== actor.userId && !isAdmin(actor)) throw new ForbiddenError();
    }

    const [row] = await tx
      .insert(stylistServices)
      .values(data)
      .onConflictDoUpdate({
        target: [stylistServices.stylistId, stylistServices.serviceId],
        set: { customPriceToman: data.customPriceToman ?? null, customDurationMinutes: data.customDurationMinutes ?? null, isActive: true },
      })
      .returning();
    return row!;
  });
}

const updateServiceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    category: categoryKey.optional(),
    durationMinutes: duration.optional(),
    bufferMinutes: z.number().int().min(0).max(120).optional(),
    priceToman: price.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** دسترسی ویرایش خدمت: خدمت سالن ← manage_services؛ خدمت مستقل ← خود آرایشگر یا ادمین */
async function assertServiceAccess(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], actor: Actor, serviceId: string) {
  const [service] = await tx.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!service) throw new NotFoundError("Service");
  if (service.salonId) {
    await assertSalonPermission(tx, actor, service.salonId, "manage_services");
  } else {
    const [stylist] = await tx.select().from(stylists).where(eq(stylists.id, service.stylistId!)).limit(1);
    if (!stylist || (stylist.userId !== actor.userId && !isAdmin(actor))) throw new ForbiddenError();
  }
  return service;
}

/** ویرایش خدمت (قیمت و مدت نوبت‌های قبلی تغییر نمی‌کند؛ در نوبت‌ها اسنپ‌شات شده‌اند) */
export async function updateService(db: Database, actor: Actor, serviceId: string, input: unknown) {
  const data = parseInput(updateServiceSchema, input);
  return db.transaction(async (tx) => {
    const current = await assertServiceAccess(tx, actor, serviceId);
    // دسته‌بندی فعلی خدمت (حتی اگر غیرفعال شده باشد) قابل حفظ است؛ تغییر فقط به دسته‌بندی فعال
    if (data.category && data.category !== current.category) await assertActiveCategory(tx, data.category);
    const [row] = await tx.update(services).set(data).where(eq(services.id, serviceId)).returning();
    return row!;
  });
}

/**
 * فعال/غیرفعال کردن ارائه یک خدمت توسط یک آرایشگر:
 * - خدمت مستقل: خود آرایشگر (یا ادمین)
 * - خدمت سالن: کاربر دارای manage_services؛ خود آرایشگر فقط می‌تواند ارائه را متوقف کند (نه فعال)
 */
export async function setStylistServiceActive(db: Database, actor: Actor, input: { stylistId: string; serviceId: string; isActive: boolean }) {
  return db.transaction(async (tx) => {
    const [service] = await tx.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
    const [stylist] = await tx.select().from(stylists).where(eq(stylists.id, input.stylistId)).limit(1);
    if (!service || !stylist) throw new NotFoundError("Service");
    const isSelf = stylist.userId === actor.userId;

    if (service.salonId) {
      if (!(isSelf && !input.isActive)) await assertSalonPermission(tx, actor, service.salonId, "manage_services");
    } else if (service.stylistId !== stylist.id || (!isSelf && !isAdmin(actor))) {
      throw new ForbiddenError();
    }

    const [row] = await tx
      .update(stylistServices)
      .set({ isActive: input.isActive })
      .where(and(eq(stylistServices.stylistId, input.stylistId), eq(stylistServices.serviceId, input.serviceId)))
      .returning();
    if (!row) throw new NotFoundError("Assignment");
    return row;
  });
}
