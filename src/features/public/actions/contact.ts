"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { formObject, runAction, type ActionState } from "@/server/actions/result";
import { getCurrentSession } from "@/server/auth/current";
import { clientIp, FixedWindowRateLimiter } from "@/server/security/rate-limit";
import { createTicket } from "@/server/support/service";

const limiter = new FixedWindowRateLimiter(5, 60 * 60_000);

/** فرم تماس/پشتیبانی/شکایت (مهمان یا کاربر واردشده) — اعتبارسنجی کامل سمت سرور */
export async function submitTicketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const h = await headers();
  if (!limiter.consume(`ip:${clientIp(h)}`).allowed) return { status: "error", message: "تعداد پیام‌های ارسالی زیاد است. لطفاً بعداً تلاش کنید." };
  const session = await getCurrentSession();
  const i = formObject(fd);
  const kind = i.kind === "support" || i.kind === "complaint" ? i.kind : "contact";
  const res = await runAction(
    () => createTicket(db, session?.actor ?? null, { kind, name: i.name, phone: i.phone, email: i.email, subject: i.subject, message: i.message }),
    session
      ? "پیام شما ثبت شد. پاسخ پشتیبانی در «پشتیبانی من» در حساب کاربری‌تان نمایش داده می‌شود."
      : "پیام شما ثبت شد. همکاران ما در اولین فرصت پاسخ می‌دهند.",
  );
  if (res.status === "success" && session) revalidatePath("/dashboard/customer/support");
  return res;
}
