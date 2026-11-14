import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { serviceCategory, services, stylistServices, stylists } from "@/db/schema";
import type { Actor } from "../auth/actor";
import { assertSalonPermission, isActiveSalonStylist } from "../auth/permissions";
import { BusinessRuleError, ForbiddenError, NotFoundError } from "../errors";
import { isAdmin } from "../auth/actor";
import { parseInput } from "../validation";

const duration = z.number().int().min(5).max(720).multipleOf(5);
const price = z.number().int().min(0).max(1_000_000_000);

const createServiceSchema = z
  .object({
    salonId: z.uuid().optional(),
    stylistId: z.uuid().optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional(),
    category: z.enum(serviceCategory.enumValues),
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
