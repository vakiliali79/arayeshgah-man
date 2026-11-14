import "server-only";

import { db } from "@/db";
import { requireSession } from "../auth/current";
import { getStylistProfile } from "./access";

/** نشست آرایشگر + پروفایل حرفه‌ای (یا null برای نمایش فرم ساخت پروفایل) */
export async function getStylistContext() {
  const ctx = await requireSession(["stylist"]);
  return { ...ctx, stylist: await getStylistProfile(db, ctx.actor.userId) };
}
