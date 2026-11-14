"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { deletePlan, savePlan, setSalonStatus, setStylistActive, updateCategory } from "@/server/admin/service";
import { formObject, runAction, type ActionState } from "@/server/actions/result";
import { setSetting, type SettingKey } from "@/server/content/settings";
import { adminSetUserRole } from "@/server/profiles/service";
import { setReviewHidden } from "@/server/reviews/service";
import { updateTicket } from "@/server/support/service";

const admin = () => requireSession(["admin"]);
const done = () => revalidatePath("/", "layout");
const bool = (fd: FormData, k: string) => fd.get(k) === "true";

export async function setUserRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const res = await runAction(() => adminSetUserRole(db, actor, { userId: String(fd.get("userId")), role: String(fd.get("role")) }), "نقش کاربر تغییر کرد.");
  done();
  return res;
}

export async function salonStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const patch: Record<string, unknown> = { salonId: String(fd.get("salonId")) };
  if (fd.has("isVerified")) patch.isVerified = bool(fd, "isVerified");
  if (fd.has("isActive")) patch.isActive = bool(fd, "isActive");
  const res = await runAction(() => setSalonStatus(db, actor, patch), "وضعیت سالن به‌روزرسانی شد.");
  done();
  return res;
}

export async function stylistActiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const res = await runAction(() => setStylistActive(db, actor, { stylistId: String(fd.get("stylistId")), isActive: bool(fd, "isActive") }), "وضعیت آرایشگر به‌روزرسانی شد.");
  done();
  return res;
}

export async function reviewHiddenAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const hidden = bool(fd, "hidden");
  const res = await runAction(() => setReviewHidden(db, actor, { reviewId: String(fd.get("reviewId")), hidden }), hidden ? "نظر پنهان شد." : "نظر دوباره نمایش داده می‌شود.");
  done();
  return res;
}

export async function ticketAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const i = formObject(fd);
  const res = await runAction(() => updateTicket(db, actor, { ticketId: i.ticketId, status: i.status, adminNote: i.adminNote }), "پیام به‌روزرسانی شد.");
  done();
  return res;
}

export async function categoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const i = formObject(fd, ["sortOrder"], ["isActive"]);
  const res = await runAction(() => updateCategory(db, actor, i), "دسته‌بندی ذخیره شد.");
  done();
  return res;
}

const lines = (v: unknown) => (typeof v === "string" ? v.split("\n").map((x) => x.trim()).filter(Boolean) : []);

export async function planAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const { planId, ...i } = formObject(fd, ["priceMonthlyToman", "sortOrder"], ["isActive", "isFeatured"]);
  const res = await runAction(() => savePlan(db, actor, { ...i, features: lines(i.features) }, planId as string | undefined), planId ? "پلن ذخیره شد." : "پلن اضافه شد.");
  done();
  return res;
}

export async function deletePlanAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await admin();
  const res = await runAction(() => deletePlan(db, actor, String(fd.get("planId"))), "پلن حذف شد.");
  done();
  return res;
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
  const res = await runAction(() => setSetting(db, actor, key, value), "تغییرات ذخیره شد.");
  done();
  return res;
}
