"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSession } from "@/server/auth/current";
import { assignServiceToStylist, createService, setStylistServiceActive, updateService } from "@/server/catalog/service";
import { formObject, runAction, toActionError, type ActionState } from "@/server/actions/result";
import { getStylistProfile } from "@/server/dashboard/access";
import { BusinessRuleError } from "@/server/errors";
import { createPortfolioItem, deletePortfolioItem } from "@/server/portfolio/service";
import { acceptSalonInvitation, declineSalonInvitation, removeSalonMember, requestSalonMembership } from "@/server/salons/service";
import { addTimeOff, addWorkingHours, deleteTimeOff, deleteWorkingHours } from "@/server/schedules/service";
import { getFileServiceDeps } from "@/server/storage";
import { createStylistProfile, updateOwnStylistProfile } from "@/server/stylists/service";
import { zonedLocalToIso } from "@/lib/format/datetime";

const done = (p = "/dashboard/stylist") => revalidatePath(p, "layout");
const splitList = (v: unknown) =>
  typeof v === "string" ? v.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean) : [];

async function requireStylist() {
  const { actor } = await requireSession(["stylist"]);
  const stylist = await getStylistProfile(db, actor.userId);
  if (!stylist) throw new BusinessRuleError("PROFILE_REQUIRED", "Stylist profile required");
  return { actor, stylist };
}

export async function createStylistProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession(["stylist"]);
  const i = formObject(fd, ["yearsExperience"], ["acceptsIndependentBookings"]);
  const res = await runAction(
    () => createStylistProfile(db, actor, { ...i, specialties: splitList(i.specialties) }),
    "پروفایل حرفه‌ای شما ساخته شد.",
  );
  done();
  return res;
}

export async function updateStylistProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession(["stylist"]);
  const i = formObject(fd, ["yearsExperience"], ["acceptsIndependentBookings"]);
  const res = await runAction(
    () =>
      updateOwnStylistProfile(db, actor, {
        displayName: i.displayName,
        slug: i.slug,
        bio: (i.bio as string | undefined) ?? null,
        specialties: splitList(i.specialties),
        yearsExperience: (i.yearsExperience as number | undefined) ?? null,
        acceptsIndependentBookings: i.acceptsIndependentBookings,
        city: (i.city as string | undefined) ?? null,
        district: (i.district as string | undefined) ?? null,
      }),
    "پروفایل ذخیره شد.",
  );
  done("/");
  return res;
}

/** خدمت مستقل جدید (و تخصیص خودکار به خود آرایشگر) */
export async function createIndependentServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor, stylist } = await requireStylist();
    const i = formObject(fd, ["durationMinutes", "bufferMinutes", "priceToman"]);
    const svc = await createService(db, actor, { ...i, stylistId: stylist.id });
    await assignServiceToStylist(db, actor, { stylistId: stylist.id, serviceId: svc.id });
    done("/");
    return { status: "success", message: "خدمت اضافه شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const { serviceId, isActive, ...rest } = formObject(fd, ["durationMinutes", "bufferMinutes", "priceToman"]);
  const patch = isActive === undefined ? rest : { ...rest, isActive: isActive === "true" };
  const res = await runAction(() => updateService(db, actor, String(serviceId), patch), "خدمت به‌روزرسانی شد.");
  done("/");
  return res;
}

export async function toggleMyServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor, stylist } = await requireStylist();
    const isActive = fd.get("isActive") === "true";
    await setStylistServiceActive(db, actor, { stylistId: stylist.id, serviceId: String(fd.get("serviceId")), isActive });
    done("/");
    return { status: "success", message: isActive ? "ارائه خدمت فعال شد." : "ارائه خدمت متوقف شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function addMyHoursAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor, stylist } = await requireStylist();
    const i = formObject(fd, ["dayOfWeek"]);
    await addWorkingHours(db, actor, { stylistId: stylist.id, dayOfWeek: i.dayOfWeek, opensAt: i.opensAt, closesAt: i.closesAt });
    done();
    return { status: "success", message: "ساعت کاری اضافه شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteHoursAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const res = await runAction(() => deleteWorkingHours(db, actor, String(fd.get("id"))), "شیفت حذف شد.");
  done("/dashboard");
  return res;
}

export async function addMyTimeOffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { actor, stylist } = await requireStylist();
    const i = formObject(fd);
    const date = String(i.date ?? "");
    const endDate = String(i.endDate ?? date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { status: "error", message: "تاریخ را انتخاب کنید." };
    await addTimeOff(db, actor, {
      stylistId: stylist.id,
      startsAt: zonedLocalToIso(date, String(i.fromTime ?? "00:00"), stylist.timezone),
      endsAt: zonedLocalToIso(endDate, String(i.toTime ?? "23:59"), stylist.timezone),
      reason: i.reason,
    });
    done();
    return { status: "success", message: "مرخصی ثبت شد." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteTimeOffAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const res = await runAction(() => deleteTimeOff(db, actor, String(fd.get("id"))), "مرخصی حذف شد.");
  done("/dashboard");
  return res;
}

export async function uploadPortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "یک تصویر انتخاب کنید." };
  const i = formObject(fd);
  const res = await runAction(
    async () =>
      createPortfolioItem(getFileServiceDeps(), actor, new Uint8Array(await file.arrayBuffer()), { title: i.title, description: i.description, salonId: i.salonId }, file.name),
    "نمونه‌کار اضافه شد.",
  );
  done("/");
  return res;
}

export async function deletePortfolioAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const res = await runAction(() => deletePortfolioItem(getFileServiceDeps(), actor, String(fd.get("id"))), "نمونه‌کار حذف شد.");
  done("/");
  return res;
}

export async function membershipAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { actor } = await requireSession();
  const op = String(fd.get("op"));
  const id = String(fd.get("membershipId") ?? "");
  const ops: Record<string, [() => Promise<unknown>, string]> = {
    accept: [() => acceptSalonInvitation(db, actor, id), "به سالن پیوستید."],
    decline: [() => declineSalonInvitation(db, actor, id), "دعوت رد شد."],
    leave: [() => removeSalonMember(db, actor, id), "از سالن خارج شدید."],
    request: [() => requestSalonMembership(db, actor, { salonSlug: String(fd.get("salonSlug") ?? "") }), "درخواست عضویت ارسال شد. پس از تأیید سالن فعال می‌شود."],
  };
  const entry = ops[op];
  if (!entry) return { status: "error", message: "عملیات نامعتبر است." };
  const res = await runAction(entry[0], entry[1]);
  done("/dashboard");
  return res;
}
