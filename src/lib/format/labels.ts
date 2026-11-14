import type { BookingStatus, MembershipStatus, SalonMemberRole, SalonPermission, TicketKind, TicketStatus } from "@/db/types";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "در انتظار تأیید",
  confirmed: "تأییدشده",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  rejected: "ردشده",
  no_show: "عدم حضور",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, "primary" | "gold" | "success" | "neutral" | "danger"> = {
  pending: "gold",
  confirmed: "primary",
  completed: "success",
  cancelled: "neutral",
  rejected: "danger",
  no_show: "danger",
};

export const MEMBER_ROLE_LABEL: Record<SalonMemberRole, string> = {
  owner: "مالک",
  manager: "مدیر",
  stylist: "آرایشگر",
  receptionist: "پذیرش",
};

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  invited: "دعوت‌شده",
  active: "فعال",
  suspended: "تعلیق",
  left: "خارج‌شده",
  requested: "درخواست عضویت",
};

export const PERMISSION_LABEL: Record<SalonPermission, string> = {
  manage_salon: "ویرایش اطلاعات سالن",
  manage_members: "مدیریت اعضا",
  manage_services: "مدیریت خدمات",
  manage_schedule: "مدیریت برنامه کاری",
  manage_bookings: "مدیریت نوبت‌ها",
  manage_portfolio: "مدیریت نمونه‌کارها",
  view_reports: "مشاهده گزارش‌ها",
};

export const TICKET_KIND_LABEL: Record<TicketKind, string> = {
  contact: "تماس با ما",
  support: "پشتیبانی",
  complaint: "شکایت",
  review_report: "گزارش نظر نامناسب",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  resolved: "حل‌شده",
  closed: "بسته",
};
