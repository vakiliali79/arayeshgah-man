import { and, eq, sql } from "drizzle-orm";
import { salons } from "@/db/schema";

/** سالن عمومی: فعال و تأییدشده توسط مدیریت */
export const salonIsPublic = and(eq(salons.isActive, true), eq(salons.isVerified, true));

/**
 * آرایشگر عمومی: فعال و (پذیرنده نوبت مستقل یا عضو فعال یک سالن عمومی).
 * ارجاع‌ها صریحاً با نام جدول نوشته شده‌اند: Drizzle در کوئری تک‌جدولی نام ستون را بدون جدول
 * می‌نویسد و داخل زیرکوئری به جدول داخلی اشاره می‌کرد.
 */
export const stylistIsPublic = sql`("stylists"."is_active" and ("stylists"."accepts_independent_bookings" or exists (
  select 1 from salon_members sm join salons sa on sa.id = sm.salon_id
  where sm.user_id = "stylists"."user_id" and sm.status = 'active' and sm.role = 'stylist' and sa.is_active and sa.is_verified
)))`;
