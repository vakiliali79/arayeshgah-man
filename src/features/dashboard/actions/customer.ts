"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { cancelBooking } from "@/server/bookings/service";
import { toggleFavorite } from "@/server/favorites/service";
import { markAllNotificationsRead } from "@/server/notifications/service";
import { formObject, runAction, toActionError, type ActionState } from "@/server/actions/result";
import { setOwnAvatar, updateOwnProfile } from "@/server/profiles/service";
import { createReview } from "@/server/reviews/service";
import { getFileServiceDeps, uploadFile } from "@/server/storage";

export async function cancelMyBookingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const bookingId = String(fd.get("bookingId") ?? "");
  const reason = String(fd.get("reason") ?? "").trim() || undefined;
  const res = await runAction(() => cancelBooking(db, actor, { bookingId, reason }), "نوبت لغو شد.");
  revalidatePath("/dashboard/customer", "layout");
  return res;
}

export async function submitReviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const input = formObject(fd, ["rating"]);
  const res = await runAction(() => createReview(db, actor, { bookingId: input.bookingId, rating: input.rating, comment: input.comment }), "نظر شما ثبت شد. سپاس از همراهی شما!");
  revalidatePath("/dashboard/customer", "layout");
  return res;
}

export async function toggleFavoriteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const input = formObject(fd);
  try {
    const { favorited } = await toggleFavorite(db, actor, { salonId: input.salonId, stylistId: input.stylistId });
    revalidatePath("/", "layout");
    return { status: "success", message: favorited ? "به علاقه‌مندی‌ها اضافه شد." : "از علاقه‌مندی‌ها حذف شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const input = formObject(fd);
  const res = await runAction(
    () => updateOwnProfile(db, actor, { fullName: input.fullName, phone: (input.phone as string | undefined) ?? null, city: (input.city as string | undefined) ?? null }),
    "اطلاعات حساب ذخیره شد.",
  );
  revalidatePath("/dashboard", "layout");
  return res;
}

export async function uploadAvatarAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "یک تصویر انتخاب کنید." };
  try {
    const stored = await uploadFile(getFileServiceDeps(), actor, new Uint8Array(await file.arrayBuffer()), {
      purpose: "avatar",
      originalName: file.name,
      declaredMimeType: file.type || undefined,
    });
    await setOwnAvatar(db, actor, stored.id);
    revalidatePath("/dashboard", "layout");
    return { status: "success", message: "تصویر پروفایل به‌روزرسانی شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function markNotificationsReadAction(): Promise<ActionState> {
  const { actor } = await requireSession();
  const n = await markAllNotificationsRead(db, actor);
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: n ? "همه اعلان‌ها خوانده شد." : "اعلان خوانده‌نشده‌ای نبود." };
}
