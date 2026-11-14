import { pgEnum } from "drizzle-orm/pg-core";

/** نقش سراسری کاربر در پلتفرم */
export const userRole = pgEnum("user_role", ["customer", "stylist", "salon_owner", "admin"]);

/** نقش عضو در یک سالن مشخص */
export const salonMemberRole = pgEnum("salon_member_role", ["owner", "manager", "stylist", "receptionist"]);

/** requested: درخواست عضویت از طرف خود آرایشگر (منتظر تأیید سالن) */
export const membershipStatus = pgEnum("membership_status", ["invited", "active", "suspended", "left", "requested"]);

/** مجوزهای ریز هر عضو در سالن */
export const salonPermission = pgEnum("salon_permission", [
  "manage_salon",
  "manage_members",
  "manage_services",
  "manage_schedule",
  "manage_bookings",
  "manage_portfolio",
  "view_reports",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
  "no_show",
]);

/** چه کسی وضعیت رزرو را تغییر داده است */
export const bookingActor = pgEnum("booking_actor", ["customer", "stylist", "salon", "admin", "system"]);

/** وضعیت حساب کاربری (تعلیق توسط مدیریت = عدم امکان ورود و ابطال نشست‌ها) */
export const accountStatus = pgEnum("account_status", ["active", "suspended"]);

/** نوع رویداد در تاریخچه پیگیری درخواست پشتیبانی */
export const ticketMessageKind = pgEnum("ticket_message_kind", ["reply", "note", "status"]);

export const filePurpose = pgEnum("file_purpose", ["avatar", "salon_cover", "salon_gallery", "portfolio"]);

export const notificationType = pgEnum("notification_type", [
  "booking_created",
  "booking_confirmed",
  "booking_rejected",
  "booking_cancelled",
  "booking_completed",
  "booking_reminder",
  "review_received",
  "membership_invited",
  "membership_updated",
  "system",
]);

/** نوع پیام‌های ورودی (تماس، پشتیبانی، شکایت، گزارش نظر نامناسب) */
export const ticketKind = pgEnum("ticket_kind", ["contact", "support", "complaint", "review_report"]);
export const ticketStatus = pgEnum("ticket_status", ["open", "in_progress", "resolved", "closed"]);

/** مخاطب پلن اشتراک */
export const planAudience = pgEnum("plan_audience", ["salon", "stylist"]);

