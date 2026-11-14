"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  adminBookingAction, adminUpdateSalon, createCategory, deletePlan, moderateReview, reviewSalon, savePlan, setSalonActive, setSalonStatus, setStylistActive, updateCategory,
} from "@/server/admin/service";
import { changeUserRole, setUserStatus } from "@/server/admin/users";
import { formObject, runAction, type ActionState } from "@/server/actions/result";
import { requireSession } from "@/server/auth/current";
import { setSetting, type SettingKey } from "@/server/content/settings";
import { addTicketMessage, setTicketStatus } from "@/server/support/service";

/** هر اقدام دوباره نقش ادمین را از دیتابیس بررسی می‌کند (فرم یا درخواست دستکاری‌شده بی‌اثر است) */
const admin = () => requireSession(["admin"]);
const done = () => revalidatePath("/", "layout");
const bool = (fd: FormData, k: string) => fd.get(k) === "true";
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

async function run(fn: () => Promise<unknown>, ok: string) {
  const res = await runAction(fn, ok);
  done();
  return res;
}

// ---------------------------------------------------------------- کاربران
export async function setUserRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  return run(() => changeUserRole(db, actor, { userId: str(fd, "userId"), role: str(fd, "role"), reason: str(fd, "reason") }), "نقش کاربر تغییر کرد.");
}

export async function setUserStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const status = str(fd, "status");
  return run(() => setUserStatus(db, actor, { userId: str(fd, "userId"), status, reason: str(fd, "reason") }), status === "suspended" ? "حساب کاربر تعلیق شد و از همه دستگاه‌ها خارج شد." : "حساب کاربر فعال شد.");
}

// ---------------------------------------------------------------- سالن‌ها
export async function reviewSalonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const decision = str(fd, "decision");
  const msg = decision === "approve" ? "سالن تأیید شد و در سایت نمایش داده می‌شود." : decision === "reject" ? "درخواست سالن رد شد." : "تأیید سالن لغو شد.";
  return run(() => reviewSalon(db, actor, { salonId: str(fd, "salonId"), decision, reason: str(fd, "reason") }), msg);
}

export async function salonActiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const isActive = bool(fd, "isActive");
  return run(() => setSalonActive(db, actor, { salonId: str(fd, "salonId"), isActive, reason: str(fd, "reason") }), isActive ? "سالن فعال شد." : "سالن غیرفعال شد.");
}

/** سازگاری با فرم‌های قبلی */
export async function salonStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const patch: Record<string, unknown> = { salonId: String(fd.get("salonId")) };
  if (fd.has("isVerified")) patch.isVerified = bool(fd, "isVerified");
  if (fd.has("isActive")) patch.isActive = bool(fd, "isActive");
  return run(() => setSalonStatus(db, actor, patch), "وضعیت سالن به‌روزرسانی شد.");
}

export async function adminUpdateSalonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const i = formObject(fd);
  const nullable = (k: string) => (typeof i[k] === "string" && (i[k] as string).length ? i[k] : null);
  return run(
    () => adminUpdateSalon(db, actor, String(i.salonId), { name: i.name, city: i.city, address: i.address, description: nullable("description"), phone: nullable("phone"), district: nullable("district"), reason: i.reason }),
    "اطلاعات سالن ذخیره شد.",
  );
}

// ---------------------------------------------------------------- آرایشگران
export async function stylistActiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const isActive = bool(fd, "isActive");
  return run(() => setStylistActive(db, actor, { stylistId: str(fd, "stylistId"), isActive, reason: str(fd, "reason") }), isActive ? "آرایشگر فعال شد." : "آرایشگر غیرفعال شد.");
}

// ---------------------------------------------------------------- نوبت‌ها
export async function bookingAdminAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const action = str(fd, "action");
  const msg: Record<string, string> = { cancel: "نوبت لغو شد.", confirm: "نوبت تأیید شد.", complete: "نوبت انجام‌شده ثبت شد.", no_show: "عدم مراجعه ثبت شد." };
  return run(() => adminBookingAction(db, actor, { bookingId: str(fd, "bookingId"), action, reason: str(fd, "reason") }), msg[action ?? ""] ?? "انجام شد.");
}

// ---------------------------------------------------------------- نظرات
export async function moderateReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const decision = str(fd, "decision");
  const msg = decision === "hide" ? "نظر مخفی شد." : decision === "show" ? "نظر دوباره نمایش داده می‌شود." : "گزارش‌ها رد شدند.";
  return run(() => moderateReview(db, actor, { reviewId: str(fd, "reviewId"), decision, reason: str(fd, "reason") }), msg);
}

// ---------------------------------------------------------------- پشتیبانی
export async function ticketMessageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const kind = str(fd, "kind");
  return run(() => addTicketMessage(db, actor, { ticketId: str(fd, "ticketId"), kind, body: str(fd, "body") }), kind === "reply" ? "پاسخ ثبت شد." : "یادداشت ثبت شد.");
}

export async function ticketStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  return run(() => setTicketStatus(db, actor, { ticketId: str(fd, "ticketId"), status: str(fd, "status"), note: str(fd, "note") }), "وضعیت درخواست به‌روزرسانی شد.");
}

// ---------------------------------------------------------------- دسته‌بندی‌ها و پلن‌ها
export async function categoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const { mode, ...i } = formObject(fd, ["sortOrder"], ["isActive"]);
  if (!i.description) delete i.description;
  return mode === "create" ? run(() => createCategory(db, actor, i), "دسته‌بندی اضافه شد.") : run(() => updateCategory(db, actor, i), "دسته‌بندی ذخیره شد.");
}

const lines = (v: unknown) => (typeof v === "string" ? v.split("\n").map((x) => x.trim()).filter(Boolean) : []);

export async function planAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const { planId, ...i } = formObject(fd, ["priceMonthlyToman", "sortOrder"], ["isActive", "isFeatured"]);
  return run(() => savePlan(db, actor, { ...i, features: lines(i.features) }, planId as string | undefined), planId ? "پلن ذخیره شد." : "پلن اضافه شد.");
}

export async function deletePlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  return run(() => deletePlan(db, actor, String(fd.get("planId"))), "پلن حذف شد.");
}

/** ذخیره تنظیمات/محتوا؛ هر کلید طرح اعتبارسنجی خودش را دارد */
export async function settingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const key = String(fd.get("key")) as SettingKey;
  const i = formObject(fd, [], key === "announcement" ? ["active"] : []);
  delete i.key;
  let value: unknown = i;
  if (key === "careers") {
    // هر خط: عنوان | نوع همکاری | توضیح
    value = {
      intro: i.intro,
      openings: lines(i.openings).map((l) => {
        const [title = "", type, description] = l.split("|").map((x) => x.trim());
        return { title, type: type || undefined, description: description || undefined };
      }),
    };
  }
  return run(() => setSetting(db, actor, key, value), "تغییرات ذخیره شد.");
}
