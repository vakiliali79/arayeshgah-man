import { z } from "zod";
import { bookingStatus } from "@/db/schema";

/**
 * ورودی ایجاد نوبت. توجه: قیمت، مدت، مشتری و وضعیت از کلاینت پذیرفته نمی‌شوند
 * (strict: هر فیلد اضافه رد می‌شود).
 * startsAt باید ISO 8601 با offset صریح باشد (مثل 2026-11-20T10:30:00+03:30 یا ...Z).
 */
export const createBookingSchema = z
  .object({
    stylistId: z.uuid(),
    serviceId: z.uuid(),
    salonId: z.uuid().optional(),
    startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
    customerNote: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const transitionSchema = z
  .object({
    bookingId: z.uuid(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listBookingsSchema = z
  .object({
    status: z.array(z.enum(bookingStatus.enumValues)).optional(),
    from: z.iso.datetime({ offset: true }).transform((v) => new Date(v)).optional(),
    to: z.iso.datetime({ offset: true }).transform((v) => new Date(v)).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .strict();
