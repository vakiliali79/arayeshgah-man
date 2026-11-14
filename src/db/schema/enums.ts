import { pgEnum } from "drizzle-orm/pg-core";

/** نقش سراسری کاربر در پلتفرم */
export const userRole = pgEnum("user_role", ["customer", "stylist", "salon_owner", "admin"]);

/** نقش عضو در یک سالن مشخص */
export const salonMemberRole = pgEnum("salon_member_role", ["owner", "manager", "stylist", "receptionist"]);

export const membershipStatus = pgEnum("membership_status", ["invited", "active", "suspended", "left"]);

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

export const serviceCategory = pgEnum("service_category", [
  "hair",
  "color",
  "nail",
  "skin",
  "makeup",
  "brow_lash",
  "spa",
  "other",
]);

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
