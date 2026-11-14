import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, FormField, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import type { ButtonVariant } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/datetime";
import type { ActionState } from "@/server/actions/result";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * اقدام مدیریتی با فیلد «دلیل» (برای اقدامات حساس اجباری است؛ سرور هم دوباره بررسی می‌کند).
 * داخل <details> تا فهرست‌ها شلوغ نشوند.
 */
export function ReasonAction({
  action, fields, summary, submitLabel, variant = "primary", reasonLabel = "دلیل", required = true, confirmText, children, id,
}: {
  action: Action;
  fields: Record<string, string>;
  summary: string;
  submitLabel: string;
  variant?: ButtonVariant;
  reasonLabel?: string;
  required?: boolean;
  confirmText?: string;
  children?: ReactNode;
  id: string;
}) {
  return (
    <details className="group rounded-md border border-border bg-surface open:p-3 open:shadow-soft">
      <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-medium text-primary-700 hover:bg-surface-muted group-open:mb-2 group-open:px-0 group-open:py-0">{summary}</summary>
      <ActionForm action={action} submitLabel={submitLabel} submitVariant={variant} submitSize="sm" confirmText={confirmText}>
        {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <FormField id={`reason-${id}`} label={required ? `${reasonLabel} (الزامی، حداقل ۵ نویسه)` : `${reasonLabel} (اختیاری)`}>
          <Textarea id={`reason-${id}`} name="reason" required={required} minLength={required ? 5 : undefined} maxLength={1000} className="min-h-20 text-sm" />
        </FormField>
      </ActionForm>
    </details>
  );
}

/** دکمه ساده یک‌مرحله‌ای */
export function QuickAction({ action, fields, label, variant = "outline", confirmText }: { action: Action; fields: Record<string, string>; label: string; variant?: ButtonVariant; confirmText?: string }) {
  return (
    <ActionForm action={action} submitLabel={label} submitVariant={variant} submitSize="sm" inline hideMessage confirmText={confirmText}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </ActionForm>
  );
}

export function AccountStatusBadge({ status }: { status: "active" | "suspended" }) {
  return status === "active" ? <Badge tone="success">فعال</Badge> : <Badge tone="danger">تعلیق‌شده</Badge>;
}

export function SalonAdminBadge({ isActive, isVerified, rejectionReason }: { isActive: boolean; isVerified: boolean; rejectionReason: string | null }) {
  if (!isActive) return <Badge tone="neutral">غیرفعال</Badge>;
  if (isVerified) return <Badge tone="success">تأییدشده</Badge>;
  return rejectionReason ? <Badge tone="danger">ردشده</Badge> : <Badge tone="gold">در انتظار تأیید</Badge>;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "user.role_change": "تغییر نقش کاربر",
  "user.suspend": "تعلیق حساب",
  "user.activate": "فعال‌سازی حساب",
  "salon.approve": "تأیید سالن",
  "salon.reject": "رد درخواست سالن",
  "salon.revoke": "لغو تأیید سالن",
  "salon.activate": "فعال‌سازی سالن",
  "salon.deactivate": "غیرفعال‌سازی سالن",
  "salon.update": "ویرایش اطلاعات سالن",
  "salon.status": "تغییر وضعیت سالن",
  "stylist.activate": "فعال‌سازی آرایشگر",
  "stylist.deactivate": "غیرفعال‌سازی آرایشگر",
  "booking.cancel": "لغو نوبت",
  "booking.confirm": "تأیید نوبت",
  "booking.complete": "ثبت انجام نوبت",
  "booking.no_show": "ثبت عدم مراجعه",
  "review.hide": "مخفی‌سازی نظر",
  "review.show": "نمایش دوباره نظر",
  "review.dismiss_reports": "رد گزارش‌های نظر",
  "ticket.reply": "پاسخ به درخواست",
  "ticket.note": "یادداشت داخلی",
  "ticket.status": "تغییر وضعیت درخواست",
  "category.create": "افزودن دسته‌بندی",
  "category.update": "ویرایش دسته‌بندی",
  "plan.create": "افزودن پلن",
  "plan.update": "ویرایش پلن",
  "plan.delete": "حذف پلن",
  "setting.update": "تغییر محتوا/تنظیمات",
};

export const AUDIT_TARGET_LABEL: Record<string, string> = {
  user: "کاربر", salon: "سالن", stylist: "آرایشگر", booking: "نوبت", review: "نظر", ticket: "درخواست پشتیبانی", category: "دسته‌بندی", plan: "پلن", setting: "تنظیمات",
};

const FIELD_LABEL: Record<string, string> = {
  role: "نقش", status: "وضعیت", isActive: "فعال", isVerified: "تأییدشده", rejectionReason: "دلیل رد", name: "نام", description: "توضیحات", phone: "تلفن", city: "شهر",
  district: "منطقه", address: "نشانی", label: "عنوان", sortOrder: "ترتیب", isHidden: "مخفی", "stylist.isActive": "پروفایل آرایشگری فعال", sessionsEnded: "نشست‌های باطل‌شده",
  reportsClosed: "گزارش‌های بسته‌شده", priceMonthlyToman: "قیمت ماهانه", isFeatured: "ویژه", features: "امکانات", value: "مقدار",
};

const VALUE_LABEL: Record<string, string> = {
  customer: "مشتری", stylist: "آرایشگر", salon_owner: "صاحب سالن", admin: "مدیر سیستم", active: "فعال", suspended: "تعلیق‌شده",
  pending: "در انتظار تأیید", confirmed: "تأییدشده", completed: "انجام‌شده", cancelled: "لغوشده", rejected: "ردشده", no_show: "عدم مراجعه",
  open: "باز", in_progress: "در حال بررسی", resolved: "رسیدگی‌شده", closed: "بسته‌شده",
};
const show = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "بله" : "خیر") : typeof v === "object" ? JSON.stringify(v) : (VALUE_LABEL[String(v)] ?? String(v));

export const TARGET_HREF: Partial<Record<string, (id: string) => string>> = {
  user: (id) => `/dashboard/admin/users/${id}`,
  salon: (id) => `/dashboard/admin/salons/${id}`,
  stylist: (id) => `/dashboard/admin/stylists/${id}`,
  booking: (id) => `/dashboard/admin/bookings/${id}`,
  ticket: (id) => `/dashboard/admin/tickets/${id}`,
};

export interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string | null;
  reason: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: Date;
  actorName: string | null;
}

/** تاریخچه اقدامات مدیریتی */
export function AuditHistory({ rows, showTarget }: { rows: AuditRow[]; showTarget?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted">هنوز اقدامی ثبت نشده است.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const href = TARGET_HREF[r.targetType]?.(r.targetId);
        return (
          <li key={r.id} className="rounded-md border border-border bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {AUDIT_ACTION_LABEL[r.action] ?? r.action}
                {showTarget && (
                  <span className="font-normal text-muted">
                    {" "}— {AUDIT_TARGET_LABEL[r.targetType] ?? r.targetType}
                    {r.summary ? `: ${r.summary}` : ""}
                    {href && <> · <Link href={href} className="text-primary-700 hover:underline">مشاهده</Link></>}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">{r.actorName ?? "مدیر حذف‌شده"} · {formatDateTime(r.createdAt)}</p>
            </div>
            {r.reason && <p className="mt-1 leading-7"><span className="text-muted">دلیل: </span>{r.reason}</p>}
            {Object.keys(r.changes).length > 0 && r.action !== "setting.update" && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted">
                {Object.entries(r.changes).map(([k, c]) => (
                  <li key={k}>{FIELD_LABEL[k] ?? k}: <span className="line-through">{show(c.from)}</span> ← <span className="text-foreground">{show(c.to)}</span></li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
