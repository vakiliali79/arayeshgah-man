import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, FormField, Rating, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { ticketMessageAction, ticketStatusAction } from "@/features/dashboard/actions/admin";
import { formatDateTime } from "@/lib/format/datetime";
import { TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from "@/lib/format/labels";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/auth/current";
import { NotFoundError } from "@/server/errors";
import { getTicketDetail } from "@/server/support/service";

export const metadata: Metadata = { title: "جزئیات درخواست" };

const KIND_STYLE = { reply: "border-primary-200 bg-primary-50", note: "border-gold-200 bg-gold-50", status: "border-border bg-surface-muted" } as const;
const KIND_LABEL = { reply: "پاسخ به کاربر", note: "یادداشت داخلی", status: "تغییر وضعیت" } as const;

export default async function AdminTicketDetail({ params }: PageProps<"/dashboard/admin/tickets/[id]">) {
  const { actor } = await requireSession(["admin"]);
  const { id } = await params;
  let d;
  try {
    d = await getTicketDetail(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const t = d.ticket;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/admin/tickets" className="text-sm text-primary-700 hover:underline">← همه درخواست‌ها</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">{t.subject}</h1>
        <span className="flex gap-2"><Badge tone="primary">{TICKET_KIND_LABEL[t.kind]}</Badge><Badge tone={t.status === "open" ? "gold" : "neutral"}>{TICKET_STATUS_LABEL[t.status]}</Badge></span>
      </header>

      <Card>
        <CardHeader><CardTitle>ارسال‌کننده و متن درخواست</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {t.name}
            {t.userId ? <> · <Link href={`/dashboard/admin/users/${t.userId}`} className="text-primary-700 hover:underline">حساب کاربری</Link></> : " · مهمان (بدون حساب)"}
            {t.phone && <> · <a href={`tel:${t.phone}`} dir="ltr" className="text-primary-700">{t.phone}</a></>}
            {t.email && <> · <a href={`mailto:${t.email}`} dir="ltr" className="text-primary-700">{t.email}</a></>}
          </p>
          <p className="text-xs text-muted">ارسال {formatDateTime(t.createdAt)}</p>
          <p className="whitespace-pre-line rounded-md bg-surface-muted p-3 leading-7">{t.message}</p>
          {d.review && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-1 flex items-center gap-2 text-xs text-muted">نظر گزارش‌شده <Rating value={d.review.rating} /> {d.review.isHidden && <Badge tone="neutral">مخفی</Badge>}</p>
              <p className="leading-7">{d.review.comment ?? "—"}</p>
              <Link href="/dashboard/admin/reviews?view=reported" className="text-xs text-primary-700 hover:underline">رسیدگی در بخش نظرات</Link>
            </div>
          )}
          {t.salonId && <p><Link href={`/dashboard/admin/salons/${t.salonId}`} className="text-primary-700 hover:underline">سالن مرتبط</Link></p>}
          {t.bookingId && <p><Link href={`/dashboard/admin/bookings/${t.bookingId}`} className="text-primary-700 hover:underline">نوبت مرتبط</Link></p>}
          {t.adminNote && <p className="text-xs text-muted">یادداشت قدیمی: {t.adminNote}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>تاریخچه پیگیری</CardTitle></CardHeader>
        <CardContent>
          {d.messages.length === 0 ? <p className="text-sm text-muted">هنوز پیگیری‌ای ثبت نشده است.</p> : (
            <ol className="space-y-2">
              {d.messages.map((m) => (
                <li key={m.id} className={cn("rounded-md border p-3 text-sm", KIND_STYLE[m.kind])}>
                  <p className="mb-1 text-xs text-muted">{KIND_LABEL[m.kind]} · {m.authorName ?? "—"} · {formatDateTime(m.createdAt)}</p>
                  <p className="whitespace-pre-line leading-7">{m.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>پاسخ یا یادداشت</CardTitle></CardHeader>
          <CardContent>
            {!t.userId && <Alert tone="warning" className="mb-3">ارسال‌کننده مهمان است؛ پاسخ فقط در سیستم ثبت می‌شود. برای اطلاع، با تلفن/ایمیل بالا تماس بگیرید.</Alert>}
            <ActionForm action={ticketMessageAction} submitLabel="ثبت" resetOnSuccess>
              <input type="hidden" name="ticketId" value={t.id} />
              <FormField id="kind" label="نوع">
                <Select id="kind" name="kind" defaultValue="reply">
                  <option value="reply">پاسخ به کاربر{t.userId ? " (در حساب کاربر نمایش داده می‌شود)" : ""}</option>
                  <option value="note">یادداشت داخلی (فقط مدیران)</option>
                </Select>
              </FormField>
              <FormField id="body" label="متن"><Textarea id="body" name="body" required minLength={2} maxLength={4000} /></FormField>
            </ActionForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>تغییر وضعیت</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={ticketStatusAction} submitLabel="ذخیره وضعیت">
              <input type="hidden" name="ticketId" value={t.id} />
              <FormField id="status" label="وضعیت">
                <Select id="status" name="status" defaultValue={t.status}>{Object.entries(TICKET_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              </FormField>
              <FormField id="note" label="توضیح (اختیاری)"><Textarea id="note" name="note" maxLength={1000} className="min-h-20" /></FormField>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
