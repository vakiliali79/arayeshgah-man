import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { markNotificationsReadAction } from "@/features/dashboard/actions/customer";
import { formatDateTime } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/auth/current";
import { listMyNotifications } from "@/server/notifications/service";

export const metadata: Metadata = { title: "اعلان‌ها" };

export default async function NotificationsPage() {
  const { actor } = await requireSession();
  const rows = await listMyNotifications(db, actor);
  const unread = rows.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="اعلان‌ها"
        description="تغییر وضعیت نوبت‌ها، نظرات جدید، پاسخ پشتیبانی و پیام‌های مدیریت"
        actions={unread > 0 ? <ActionForm action={markNotificationsReadAction} submitLabel="علامت‌گذاری همه به‌عنوان خوانده‌شده" submitVariant="outline" submitSize="sm" inline /> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<BellIcon />} title="اعلانی ندارید" description="وقتی وضعیت نوبتی تغییر کند یا پاسخی دریافت کنید، اینجا نمایش داده می‌شود." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((n) => {
            const body = (
              <>
                <p className={cn("text-sm", !n.readAt && "font-bold")}>
                  {!n.readAt && <span className="me-2 inline-block size-2 rounded-full bg-danger align-middle" aria-label="خوانده‌نشده" />}
                  {n.title}
                </p>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </>
            );
            return (
              <li key={n.id} className={cn(!n.readAt && "bg-primary-50/40")}>
                {n.href ? <Link href={n.href} className="block px-4 py-3 hover:bg-surface-muted/60">{body}</Link> : <div className="px-4 py-3">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
