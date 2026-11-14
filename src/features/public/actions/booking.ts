"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { zonedLocalToIso } from "@/lib/format/datetime";
import { toActionError, type ActionState } from "@/server/actions/result";
import { getCurrentSession } from "@/server/auth/current";
import { createBooking } from "@/server/bookings/service";
import { resolveBookingContext } from "@/server/public/slots";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * ثبت نهایی نوبت. فقط شناسه‌ها، تاریخ و ساعت محلی از فرم خوانده می‌شود؛ منطقه زمانی، قیمت و مدت
 * از دیتابیس می‌آیند و همه قوانین (تداخل، ساعات کاری، تعطیلی، گذشته بودن) در createBooking و
 * داخل تراکنش بررسی می‌شوند.
 */
export async function createBookingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { status: "error", message: "برای ثبت نوبت ابتدا وارد حساب خود شوید." };

  const stylistId = String(fd.get("stylistId") ?? "");
  const serviceId = String(fd.get("serviceId") ?? "");
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("time") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!UUID.test(stylistId) || !UUID.test(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { status: "error", message: "اطلاعات نوبت معتبر نیست. لطفاً دوباره زمان را انتخاب کنید." };
  }
  if (note.length > 500) return { status: "error", message: "توضیحات حداکثر ۵۰۰ نویسه است.", fieldErrors: { note: "حداکثر ۵۰۰ نویسه" } };

  let bookingId: string;
  try {
    const ctx = await resolveBookingContext(db, stylistId, serviceId);
    if (!ctx) return { status: "error", message: "این خدمت در حال حاضر قابل رزرو نیست." };
    const booking = await createBooking(db, session.actor, {
      stylistId,
      serviceId,
      ...(ctx.salonId ? { salonId: ctx.salonId } : {}),
      startsAt: zonedLocalToIso(date, time, ctx.timezone),
      ...(note ? { customerNote: note } : {}),
    });
    bookingId = booking.id;
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/dashboard/customer/bookings/${bookingId}?created=1`);
}
