import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db/client";
import { stylists, workingHours, workingTimeOff } from "@/db/schema";
import { isAdmin, type Actor } from "../auth/actor";
import { assertSalonPermission, isActiveSalonStylist } from "../auth/permissions";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { parseInput } from "../validation";

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use HH:MM");

const workingHoursSchema = z
  .object({
    salonId: z.uuid().optional(),
    stylistId: z.uuid().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeOfDay,
    closesAt: timeOfDay,
  })
  .refine((v) => v.salonId || v.stylistId, "salonId or stylistId is required")
  .refine((v) => v.closesAt > v.opensAt, "closesAt must be after opensAt");

/** مجوز ویرایش برنامه یک سالن/آرایشگر */
async function assertScheduleAccess(db: DbOrTx, actor: Actor, salonId?: string, stylistId?: string) {
  if (salonId) {
    await assertSalonPermission(db, actor, salonId, "manage_schedule");
    if (stylistId) {
      const [stylist] = await db.select().from(stylists).where(eq(stylists.id, stylistId)).limit(1);
      if (!stylist) throw new NotFoundError("Stylist");
      if (!(await isActiveSalonStylist(db, salonId, stylist.userId))) {
        throw new BusinessRuleError("STYLIST_NOT_IN_SALON", "Stylist is not an active member of this salon");
      }
    }
    return;
  }
  const [stylist] = await db.select().from(stylists).where(eq(stylists.id, stylistId!)).limit(1);
  if (!stylist) throw new NotFoundError("Stylist");
  if (stylist.userId !== actor.userId && !isAdmin(actor)) throw new ForbiddenError();
}

export async function addWorkingHours(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(workingHoursSchema, input);
  return db.transaction(async (tx) => {
    await assertScheduleAccess(tx, actor, data.salonId, data.stylistId);
    try {
      const [row] = await tx.insert(workingHours).values(data).returning();
      return row!;
    } catch (err) {
      if (findPgError(err)?.code === PG.EXCLUSION_VIOLATION) throw new ConflictError("SHIFT_OVERLAP", "Working hours overlap an existing shift");
      throw err;
    }
  });
}

const timeOffSchema = z
  .object({
    salonId: z.uuid().optional(),
    stylistId: z.uuid().optional(),
    startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    endsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.salonId || v.stylistId, "salonId or stylistId is required")
  .refine((v) => v.endsAt > v.startsAt, "endsAt must be after startsAt");

/** ثبت تعطیلی/مرخصی. نوبت‌های فعال موجود در آن بازه لغو نمی‌شوند و باید جداگانه مدیریت شوند. */
export async function addTimeOff(db: Database, actor: Actor, input: unknown) {
  const data = parseInput(timeOffSchema, input);
  return db.transaction(async (tx) => {
    await assertScheduleAccess(tx, actor, data.salonId, data.stylistId);
    const [row] = await tx.insert(workingTimeOff).values({ ...data, createdBy: actor.userId }).returning();
    return row!;
  });
}

/** حذف یک شیفت (همان قواعد دسترسی افزودن) */
export async function deleteWorkingHours(db: Database, actor: Actor, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(workingHours).where(eq(workingHours.id, id)).limit(1);
    if (!row) throw new NotFoundError("Working hours");
    await assertScheduleAccess(tx, actor, row.salonId ?? undefined, row.stylistId ?? undefined);
    await tx.delete(workingHours).where(eq(workingHours.id, id));
  });
}

/** حذف تعطیلی/مرخصی (همان قواعد دسترسی افزودن) */
export async function deleteTimeOff(db: Database, actor: Actor, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(workingTimeOff).where(eq(workingTimeOff.id, id)).limit(1);
    if (!row) throw new NotFoundError("Time off");
    await assertScheduleAccess(tx, actor, row.salonId ?? undefined, row.stylistId ?? undefined);
    await tx.delete(workingTimeOff).where(eq(workingTimeOff.id, id));
  });
}
