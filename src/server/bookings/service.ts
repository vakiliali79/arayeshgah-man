import { and, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import type { Database, DbOrTx, Transaction } from "@/db/client";
import { bookingEvents, bookings, notifications, salons, services, stylistServices, stylists } from "@/db/schema";
import type { Booking, BookingActor, BookingStatus } from "@/db/types";
import { isAdmin, type Actor } from "../auth/actor";
import { assertSalonPermission, hasSalonPermission, isActiveSalonStylist } from "../auth/permissions";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, PG, findPgError } from "../errors";
import { addMinutes } from "../time";
import { parseInput } from "../validation";
import { hasTimeOffConflict, isSalonOpen, isStylistWorking } from "./availability";
import { BOOKING_RULES, TRANSITIONS, canTransition, type BookingAction } from "./rules";
import { createBookingSchema, listBookingsSchema, transitionSchema } from "./schemas";
import { generateTrackingCode } from "./tracking";

export interface Clock {
  /** ساعت قابل تزریق برای تست؛ پیش‌فرض زمان واقعی */
  now?: Date;
}

export class BookingConflictError extends ConflictError {
  constructor(code: "SLOT_TAKEN" | "CUSTOMER_OVERLAP") {
    super(
      code,
      code === "SLOT_TAKEN"
        ? "This time slot is no longer available for the selected stylist"
        : "You already have another active booking at this time",
    );
  }
}

/**
 * ایجاد نوبت.
 * همه اعتبارسنجی‌ها در یک تراکنش سمت سرور انجام می‌شوند و قیمت/مدت فقط از دیتابیس خوانده می‌شود.
 * تضمین نهایی عدم تداخل (حتی برای درخواست‌های هم‌زمان) با exclusion constraint در PostgreSQL است.
 */
export async function createBooking(db: Database, actor: Actor, input: unknown, clock: Clock = {}): Promise<Booking> {
  // برخورد کد پیگیری تقریباً غیرممکن است؛ در صورت وقوع یک‌بار دیگر تلاش می‌شود
  try {
    return await createBookingOnce(db, actor, input, clock);
  } catch (err) {
    if (findPgError(err)?.constraint === "bookings_tracking_code_unique") return createBookingOnce(db, actor, input, clock);
    throw err;
  }
}

async function createBookingOnce(db: Database, actor: Actor, input: unknown, clock: Clock): Promise<Booking> {
  const data = parseInput(createBookingSchema, input);
  const now = clock.now ?? new Date();
  const startsAt = data.startsAt;

  // ---- قوانین زمانی مستقل از دیتابیس ----
  if (startsAt.getUTCSeconds() !== 0 || startsAt.getUTCMilliseconds() !== 0 || startsAt.getUTCMinutes() % BOOKING_RULES.slotGranularityMinutes !== 0) {
    throw new BusinessRuleError("INVALID_SLOT", `Start time must align to ${BOOKING_RULES.slotGranularityMinutes}-minute slots`);
  }
  if (startsAt < addMinutes(now, BOOKING_RULES.minLeadMinutes)) {
    throw new BusinessRuleError("TOO_SOON", "Bookings must start in the future with enough notice");
  }
  if (startsAt > addMinutes(now, BOOKING_RULES.maxAdvanceDays * 24 * 60)) {
    throw new BusinessRuleError("TOO_FAR", "Bookings cannot be made that far in advance");
  }

  try {
    return await db.transaction(async (tx) => {
      // ---- آرایشگر ----
      const [stylist] = await tx.select().from(stylists).where(eq(stylists.id, data.stylistId)).limit(1);
      if (!stylist || !stylist.isActive) throw new NotFoundError("Stylist");
      if (stylist.userId === actor.userId) throw new BusinessRuleError("SELF_BOOKING", "Stylists cannot book themselves");

      // ---- خدمت + تخصیص به آرایشگر (قیمت/مدت اختصاصی) ----
      const [row] = await tx
        .select({ service: services, assignment: stylistServices })
        .from(services)
        .innerJoin(stylistServices, and(eq(stylistServices.serviceId, services.id), eq(stylistServices.stylistId, stylist.id)))
        .where(eq(services.id, data.serviceId))
        .limit(1);
      if (!row || !row.service.isActive || !row.assignment.isActive) {
        throw new BusinessRuleError("SERVICE_NOT_OFFERED", "This stylist does not offer the selected service");
      }
      const { service, assignment } = row;

      // ---- محل ارائه خدمت: سالن یا مستقل ----
      let salonId: string | null = null;
      let timezone = stylist.timezone;
      if (service.salonId) {
        if (data.salonId && data.salonId !== service.salonId) {
          throw new BusinessRuleError("SALON_MISMATCH", "Service does not belong to the selected salon");
        }
        const [salon] = await tx.select().from(salons).where(eq(salons.id, service.salonId)).limit(1);
        if (!salon || !salon.isActive) throw new NotFoundError("Salon");
        if (!(await isActiveSalonStylist(tx, salon.id, stylist.userId))) {
          throw new BusinessRuleError("STYLIST_NOT_IN_SALON", "Stylist is not an active member of this salon");
        }
        salonId = salon.id;
        timezone = salon.timezone;
      } else {
        if (data.salonId) throw new BusinessRuleError("SALON_MISMATCH", "This is an independent service");
        if (service.stylistId !== stylist.id || !stylist.acceptsIndependentBookings) {
          throw new BusinessRuleError("INDEPENDENT_NOT_ACCEPTED", "Stylist does not accept independent bookings");
        }
      }

      // ---- قیمت و مدت از دیتابیس (هرگز از کلاینت) ----
      const durationMinutes = assignment.customDurationMinutes ?? service.durationMinutes;
      const priceToman = assignment.customPriceToman ?? service.priceToman;
      const bufferMinutes = service.bufferMinutes;
      const endsAt = addMinutes(startsAt, durationMinutes);
      const blockedUntil = addMinutes(endsAt, bufferMinutes);

      // ---- ساعات کاری و تعطیلی‌ها ----
      if (salonId && !(await isSalonOpen(tx, salonId, startsAt, endsAt, timezone))) {
        throw new BusinessRuleError("SALON_CLOSED", "The salon is closed at the requested time");
      }
      if (!(await isStylistWorking(tx, stylist.id, salonId, startsAt, endsAt, timezone))) {
        throw new BusinessRuleError("STYLIST_UNAVAILABLE", "The stylist is not working at the requested time");
      }
      if (await hasTimeOffConflict(tx, stylist.id, salonId, startsAt, blockedUntil)) {
        throw new BusinessRuleError("TIME_OFF", "The requested time falls within a holiday or time off");
      }

      // ---- درج؛ exclusion constraint تداخل را حتی در درخواست‌های هم‌زمان رد می‌کند ----
      const [booking] = await tx
        .insert(bookings)
        .values({
          customerId: actor.userId,
          stylistId: stylist.id,
          salonId,
          serviceId: service.id,
          status: "pending",
          startsAt,
          endsAt,
          blockedUntil,
          serviceName: service.name,
          durationMinutes,
          bufferMinutes,
          priceToman,
          timezone,
          customerNote: data.customerNote,
          trackingCode: generateTrackingCode(),
        })
        .returning();

      await tx.insert(bookingEvents).values({
        bookingId: booking!.id,
        fromStatus: null,
        toStatus: "pending",
        actorType: "customer",
        actorUserId: actor.userId,
      });
      await tx.insert(notifications).values({
        userId: stylist.userId,
        type: "booking_created",
        title: "نوبت جدید ثبت شد",
        body: `${service.name}`,
        data: { bookingId: booking!.id },
      });

      return booking!;
    });
  } catch (err) {
    throw mapBookingDbError(err);
  }
}

function mapBookingDbError(err: unknown): unknown {
  const pg = findPgError(err);
  if (pg?.code === PG.EXCLUSION_VIOLATION) {
    return new BookingConflictError(pg.constraint === "bookings_no_customer_overlap" ? "CUSTOMER_OVERLAP" : "SLOT_TAKEN");
  }
  return err;
}

/** رابطه کاربر با یک نوبت — از دیتابیس محاسبه می‌شود */
async function resolveRelation(tx: DbOrTx, actor: Actor, booking: Booking) {
  const [stylist] = await tx.select({ userId: stylists.userId }).from(stylists).where(eq(stylists.id, booking.stylistId)).limit(1);
  return {
    isCustomer: booking.customerId === actor.userId,
    isStylist: stylist?.userId === actor.userId,
    isSalonStaff: booking.salonId ? await hasSalonPermission(tx, actor, booking.salonId, "manage_bookings") : false,
    isAdmin: isAdmin(actor),
    stylistUserId: stylist?.userId ?? null,
  };
}

const NOTIFY: Record<BookingAction, { type: (typeof notifications.$inferInsert)["type"]; title: string }> = {
  confirm: { type: "booking_confirmed", title: "نوبت شما تأیید شد" },
  reject: { type: "booking_rejected", title: "نوبت شما رد شد" },
  cancel: { type: "booking_cancelled", title: "نوبت لغو شد" },
  complete: { type: "booking_completed", title: "خدمت انجام شد؛ نظرتان را ثبت کنید" },
  no_show: { type: "booking_cancelled", title: "عدم حضور در نوبت ثبت شد" },
};

/**
 * تغییر وضعیت نوبت با قفل سطری (SELECT … FOR UPDATE) تا تغییرات هم‌زمان سریالی شوند.
 */
async function transition(db: Database, actor: Actor, action: BookingAction, input: unknown, clock: Clock): Promise<Booking> {
  const { bookingId, reason } = parseInput(transitionSchema, input);
  const now = clock.now ?? new Date();

  return db.transaction(async (tx: Transaction) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update").limit(1);
    if (!booking) throw new NotFoundError("Booking");

    const rel = await resolveRelation(tx, actor, booking);
    const isProvider = rel.isStylist || rel.isSalonStaff || rel.isAdmin;

    // ---- مجوز ----
    if (action === "cancel") {
      if (!rel.isCustomer && !isProvider) throw new ForbiddenError();
    } else if (!isProvider) {
      // مشتری نمی‌تواند نوبت خودش را تأیید/تکمیل کند
      throw new ForbiddenError();
    }

    // ---- انتقال وضعیت ----
    if (!canTransition(booking.status, action)) {
      throw new BusinessRuleError("INVALID_TRANSITION", `Cannot ${action} a ${booking.status} booking`);
    }

    // ---- قوانین زمانی ----
    if ((action === "confirm" || action === "reject" || action === "cancel") && booking.startsAt <= now) {
      throw new BusinessRuleError("ALREADY_STARTED", "The appointment has already started");
    }
    if (
      action === "cancel" &&
      rel.isCustomer &&
      !isProvider &&
      booking.startsAt < addMinutes(now, BOOKING_RULES.customerCancelCutoffMinutes)
    ) {
      throw new BusinessRuleError("CANCEL_WINDOW_PASSED", "It is too late to cancel this appointment");
    }
    if ((action === "complete" || action === "no_show") && booking.startsAt > now) {
      throw new BusinessRuleError("NOT_STARTED", "The appointment has not started yet");
    }

    const actorType: BookingActor = rel.isCustomer && action === "cancel"
      ? "customer"
      : rel.isStylist
        ? "stylist"
        : rel.isSalonStaff && !rel.isAdmin
          ? "salon"
          : rel.isAdmin
            ? "admin"
            : "salon";

    const to = TRANSITIONS[action].to;
    const patch: Partial<typeof bookings.$inferInsert> = { status: to };
    if (to === "confirmed") patch.confirmedAt = now;
    if (to === "completed") patch.completedAt = now;
    if (to === "rejected") {
      patch.rejectedAt = now;
      patch.cancellationReason = reason ?? null;
    }
    if (to === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelledBy = actorType;
      patch.cancellationReason = reason ?? null;
    }

    const [updated] = await tx.update(bookings).set(patch).where(eq(bookings.id, booking.id)).returning();
    await tx.insert(bookingEvents).values({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: to,
      actorType,
      actorUserId: actor.userId,
      note: reason,
    });

    // اطلاع به طرف مقابل
    const recipient = actorType === "customer" ? rel.stylistUserId : booking.customerId;
    if (recipient && recipient !== actor.userId) {
      await tx.insert(notifications).values({
        userId: recipient,
        type: NOTIFY[action].type,
        title: NOTIFY[action].title,
        body: booking.serviceName,
        data: { bookingId: booking.id, status: to },
      });
    }
    return updated!;
  });
}

export const confirmBooking = (db: Database, actor: Actor, input: unknown, clock: Clock = {}) => transition(db, actor, "confirm", input, clock);
export const rejectBooking = (db: Database, actor: Actor, input: unknown, clock: Clock = {}) => transition(db, actor, "reject", input, clock);
export const cancelBooking = (db: Database, actor: Actor, input: unknown, clock: Clock = {}) => transition(db, actor, "cancel", input, clock);
export const completeBooking = (db: Database, actor: Actor, input: unknown, clock: Clock = {}) => transition(db, actor, "complete", input, clock);
export const markNoShow = (db: Database, actor: Actor, input: unknown, clock: Clock = {}) => transition(db, actor, "no_show", input, clock);

// ------------------------------------------------------------------ Queries

function listFilters(input: unknown) {
  const f = parseInput(listBookingsSchema, input ?? {});
  const where: SQL[] = [];
  if (f.status?.length) where.push(inArray(bookings.status, f.status as BookingStatus[]));
  if (f.from) where.push(gte(bookings.startsAt, f.from));
  if (f.to) where.push(lt(bookings.startsAt, f.to));
  return { where, limit: f.limit, offset: f.offset };
}

/** تاریخچه نوبت‌های خود مشتری */
export async function listMyBookings(db: DbOrTx, actor: Actor, input?: unknown) {
  const f = listFilters(input);
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.customerId, actor.userId), ...f.where))
    .orderBy(desc(bookings.startsAt))
    .limit(f.limit)
    .offset(f.offset);
}

/** نوبت‌های یک آرایشگر — فقط خود آرایشگر یا ادمین */
export async function listStylistBookings(db: DbOrTx, actor: Actor, stylistId: string, input?: unknown) {
  const [stylist] = await db.select({ userId: stylists.userId }).from(stylists).where(eq(stylists.id, stylistId)).limit(1);
  if (!stylist) throw new NotFoundError("Stylist");
  if (stylist.userId !== actor.userId && !isAdmin(actor)) throw new ForbiddenError();
  const f = listFilters(input);
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.stylistId, stylistId), ...f.where))
    .orderBy(desc(bookings.startsAt))
    .limit(f.limit)
    .offset(f.offset);
}

/** نوبت‌های یک سالن — نیازمند manage_bookings */
export async function listSalonBookings(db: DbOrTx, actor: Actor, salonId: string, input?: unknown) {
  await assertSalonPermission(db, actor, salonId, "manage_bookings");
  const f = listFilters(input);
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.salonId, salonId), ...f.where))
    .orderBy(desc(bookings.startsAt))
    .limit(f.limit)
    .offset(f.offset);
}

/** جزئیات نوبت + تاریخچه وضعیت — فقط طرفین نوبت، کارکنان سالن یا ادمین */
export async function getBookingWithHistory(db: DbOrTx, actor: Actor, bookingId: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new NotFoundError("Booking");
  const rel = await resolveRelation(db, actor, booking);
  if (!rel.isCustomer && !rel.isStylist && !rel.isSalonStaff && !rel.isAdmin) throw new NotFoundError("Booking");
  const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, bookingId)).orderBy(bookingEvents.createdAt);
  return { booking, events };
}
