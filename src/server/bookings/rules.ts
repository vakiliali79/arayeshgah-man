import type { BookingStatus } from "@/db/types";

/** قوانین زمانی رزرو */
export const BOOKING_RULES = {
  /** حداقل فاصله شروع نوبت از اکنون */
  minLeadMinutes: 15,
  /** حداکثر بازه رزرو آینده */
  maxAdvanceDays: 90,
  /** نوبت‌ها روی مضرب ۵ دقیقه شروع می‌شوند */
  slotGranularityMinutes: 5,
  /** مشتری تا این مدت قبل از شروع می‌تواند لغو کند */
  customerCancelCutoffMinutes: 120,
} as const;

/** وضعیت‌هایی که بازه زمانی آرایشگر را اشغال می‌کنند (همان شرط exclusion constraint) */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const satisfies readonly BookingStatus[];

export type BookingAction = "confirm" | "reject" | "cancel" | "complete" | "no_show";

/** ماشین وضعیت — باید با trigger bookings_guard در مایگریشن 0001 هم‌خوان باشد */
export const TRANSITIONS: Record<BookingAction, { from: readonly BookingStatus[]; to: BookingStatus }> = {
  confirm: { from: ["pending"], to: "confirmed" },
  reject: { from: ["pending"], to: "rejected" },
  cancel: { from: ["pending", "confirmed"], to: "cancelled" },
  complete: { from: ["confirmed"], to: "completed" },
  no_show: { from: ["confirmed"], to: "no_show" },
};

export function canTransition(from: BookingStatus, action: BookingAction): boolean {
  return TRANSITIONS[action].from.includes(from);
}

/** آیا مشتری هنوز می‌تواند این نوبت را لغو کند؟ (همان قانونی که سرور هنگام لغو اعمال می‌کند) */
export function canCustomerCancel(b: { status: BookingStatus; startsAt: Date }, now: Date = new Date()): boolean {
  return (b.status === "pending" || b.status === "confirmed") && b.startsAt.getTime() - now.getTime() >= BOOKING_RULES.customerCancelCutoffMinutes * 60_000;
}
