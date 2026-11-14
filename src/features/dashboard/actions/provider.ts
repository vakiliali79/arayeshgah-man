"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { cancelBooking, completeBooking, confirmBooking, markNoShow, rejectBooking } from "@/server/bookings/service";
import { runAction, type ActionState } from "@/server/actions/result";
import { replyToReview } from "@/server/reviews/service";

const TRANSITIONS = {
  confirm: { fn: confirmBooking, ok: "نوبت تأیید شد." },
  reject: { fn: rejectBooking, ok: "نوبت رد شد." },
  cancel: { fn: cancelBooking, ok: "نوبت لغو شد." },
  complete: { fn: completeBooking, ok: "نوبت انجام‌شده ثبت شد." },
  no_show: { fn: markNoShow, ok: "عدم حضور مشتری ثبت شد." },
} as const;

/** تغییر وضعیت نوبت توسط آرایشگر/سالن/ادمین — مجوز در سرویس نوبت بررسی می‌شود */
export async function providerBookingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const op = String(fd.get("op") ?? "") as keyof typeof TRANSITIONS;
  const t = TRANSITIONS[op];
  if (!t) return { status: "error", message: "عملیات نامعتبر است." };
  const bookingId = String(fd.get("bookingId") ?? "");
  const reason = String(fd.get("reason") ?? "").trim() || undefined;
  const res = await runAction(() => t.fn(db, actor, { bookingId, reason }), t.ok);
  revalidatePath("/dashboard", "layout");
  return res;
}

export async function replyReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const res = await runAction(() => replyToReview(db, actor, { reviewId: String(fd.get("reviewId") ?? ""), reply: String(fd.get("reply") ?? "") }), "پاسخ ثبت شد.");
  revalidatePath("/dashboard", "layout");
  return res;
}
