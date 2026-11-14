"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import type { SalonPermission } from "@/db/types";
import { salonPermission } from "@/db/schema";
import { requireSession } from "@/server/auth/current";
import { assignServiceToStylist, createService, setStylistServiceActive } from "@/server/catalog/service";
import { formObject, runAction, toActionError, type ActionState } from "@/server/actions/result";
import {
  createSalon,
  inviteSalonMemberByPhone,
  removeSalonMember,
  respondToMembershipRequest,
  setSalonCover,
  updateMemberPermissions,
  updateSalon,
} from "@/server/salons/service";
import { addTimeOff, addWorkingHours } from "@/server/schedules/service";
import { getFileServiceDeps, uploadFile } from "@/server/storage";
import { zonedLocalToIso } from "@/lib/format/datetime";
import { getSalon } from "@/server/salons/dashboard";

const done = () => revalidatePath("/", "layout");
const sid = (fd: FormData) => String(fd.get("salonId") ?? "");

export async function createSalonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession(["salon_owner", "admin"]);
  const i = formObject(fd, ["latitude", "longitude"]);
  let salonId: string;
  try {
    salonId = (await createSalon(db, actor, i)).id;
  } catch (err) {
    return toActionError(err);
  }
  done();
  redirect(`/dashboard/salon/${salonId}?created=1`);
}

export async function updateSalonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const { salonId, ...i } = formObject(fd, ["latitude", "longitude"]);
  const res = await runAction(() => updateSalon(db, actor, String(salonId), i), "اطلاعات سالن ذخیره شد.");
  done();
  return res;
}

export async function uploadSalonCoverAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const file = fd.get("cover");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "یک تصویر انتخاب کنید." };
  try {
    const stored = await uploadFile(getFileServiceDeps(), actor, new Uint8Array(await file.arrayBuffer()), {
      purpose: "salon_cover",
      salonId: sid(fd),
      originalName: file.name,
      declaredMimeType: file.type || undefined,
    });
    await setSalonCover(db, actor, sid(fd), stored.id);
    done();
    return { status: "success", message: "تصویر کاور به‌روزرسانی شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addSalonServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const i = formObject(fd, ["durationMinutes", "bufferMinutes", "priceToman"]);
  const res = await runAction(() => createService(db, actor, i), "خدمت اضافه شد.");
  done();
  return res;
}

export async function assignStylistAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const i = formObject(fd, ["customPriceToman", "customDurationMinutes"]);
  const res = await runAction(() => assignServiceToStylist(db, actor, { stylistId: i.stylistId, serviceId: i.serviceId, customPriceToman: i.customPriceToman, customDurationMinutes: i.customDurationMinutes }), "آرایشگر به این خدمت اضافه شد.");
  done();
  return res;
}

export async function toggleAssignmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const isActive = fd.get("isActive") === "true";
  const res = await runAction(
    () => setStylistServiceActive(db, actor, { stylistId: String(fd.get("stylistId")), serviceId: String(fd.get("serviceId")), isActive }),
    isActive ? "ارائه خدمت فعال شد." : "ارائه خدمت متوقف شد.",
  );
  done();
  return res;
}

export async function inviteMemberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const i = formObject(fd);
  const role = i.role === "manager" || i.role === "receptionist" ? i.role : "stylist";
  const res = await runAction(() => inviteSalonMemberByPhone(db, actor, { salonId: sid(fd), phone: String(i.phone ?? ""), role }), "دعوت ارسال شد. پس از پذیرش، عضو فعال می‌شود.");
  done();
  return res;
}

export async function respondRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const approve = fd.get("approve") === "true";
  const res = await runAction(() => respondToMembershipRequest(db, actor, { membershipId: String(fd.get("membershipId")), approve }), approve ? "درخواست پذیرفته شد." : "درخواست رد شد.");
  done();
  return res;
}

export async function updatePermissionsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const permissions = fd.getAll("permissions").map(String).filter((p): p is SalonPermission => (salonPermission.enumValues as readonly string[]).includes(p));
  const res = await runAction(() => updateMemberPermissions(db, actor, { membershipId: String(fd.get("membershipId")), permissions }), "سطح دسترسی ذخیره شد.");
  done();
  return res;
}

export async function removeMemberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const res = await runAction(() => removeSalonMember(db, actor, String(fd.get("membershipId"))), "عضو از تیم حذف شد.");
  done();
  return res;
}

export async function addSalonHoursAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const i = formObject(fd, ["dayOfWeek"]);
  const res = await runAction(() => addWorkingHours(db, actor, { salonId: i.salonId, stylistId: i.stylistId, dayOfWeek: i.dayOfWeek, opensAt: i.opensAt, closesAt: i.closesAt }), "شیفت اضافه شد.");
  done();
  return res;
}

export async function addSalonTimeOffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const i = formObject(fd);
  const date = String(i.date ?? "");
  const endDate = String(i.endDate ?? date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { status: "error", message: "تاریخ را انتخاب کنید." };
  try {
    const salon = await getSalon(db, sid(fd));
    await addTimeOff(db, actor, {
      salonId: salon.id,
      stylistId: i.stylistId,
      startsAt: zonedLocalToIso(date, String(i.fromTime ?? "00:00"), salon.timezone),
      endsAt: zonedLocalToIso(endDate, String(i.toTime ?? "23:59"), salon.timezone),
      reason: i.reason,
    });
    done();
    return { status: "success", message: "تعطیلی ثبت شد." };
  } catch (err) {
    return toActionError(err);
  }
}
