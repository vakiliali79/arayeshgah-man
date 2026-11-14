import "server-only";

import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireSession } from "../auth/current";
import { getSalonAccess } from "../auth/permissions";
import { NotFoundError } from "../errors";
import { getSalon } from "../salons/dashboard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** سالن + دسترسی کاربر؛ بدون هیچ مجوزی صفحه 404 (وجود سالن هم افشا نمی‌شود) */
export async function getSalonContext(salonId: string) {
  const session = await requireSession();
  if (!UUID.test(salonId)) notFound();
  try {
    const access = await getSalonAccess(db, session.actor, salonId);
    if (access.permissions.size === 0) notFound();
    return { ...session, access, salon: await getSalon(db, salonId) };
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}
