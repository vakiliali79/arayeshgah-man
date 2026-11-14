"use server";

import { db } from "@/db";
import { formObject, runAction, type ActionState } from "@/server/actions/result";
import { getCurrentSession } from "@/server/auth/current";
import { reportReview } from "@/server/support/service";

/** گزارش نظر نامناسب (فقط کاربر واردشده؛ برای بررسی در پنل ادمین) */
export async function reportReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { status: "error", message: "برای گزارش نظر ابتدا وارد حساب شوید." };
  const i = formObject(fd);
  const reason = String(i.reason ?? "").trim();
  if (reason.length < 10) return { status: "error", message: "دلیل گزارش را دست‌کم در ۱۰ نویسه بنویسید." };
  return runAction(
    () => reportReview(db, session.actor, session.profile.fullName ?? session.user.name, { reviewId: i.reviewId, reason: i.reason }),
    "گزارش شما ثبت شد و توسط مدیریت بررسی می‌شود.",
  );
}
