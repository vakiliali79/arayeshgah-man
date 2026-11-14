import type { Metadata } from "next";
import { InboxIcon } from "@/components/icons";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { TicketForm } from "@/features/public/components/ticket-form";
import { formatDateTime } from "@/lib/format/datetime";
import { TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from "@/lib/format/labels";
import { requireSession } from "@/server/auth/current";
import { toLocalPhone } from "@/server/otp/phone";
import { listMyTickets } from "@/server/support/service";

export const metadata: Metadata = { title: "پشتیبانی من" };

export default async function MySupportPage() {
  const { actor, profile, user } = await requireSession();
  const tickets = await listMyTickets(db, actor);
  return (
    <>
      <PageHeader title="پشتیبانی من" description="درخواست‌های شما و پاسخ‌های تیم پشتیبانی" />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="my-tickets" className="min-w-0">
          <h2 id="my-tickets" className="sr-only">درخواست‌های من</h2>
          {tickets.length === 0 ? (
            <EmptyState icon={<InboxIcon />} title="هنوز درخواستی ثبت نکرده‌اید" description="با فرم «درخواست جدید»، سؤال یا مشکل خود را برای پشتیبانی بفرستید." />
          ) : (
            <ul className="space-y-4">
              {tickets.map((t) => (
                <li key={t.id} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{t.subject}</p>
                    <span className="flex gap-2"><Badge tone="primary">{TICKET_KIND_LABEL[t.kind]}</Badge><Badge tone={t.status === "open" ? "gold" : t.status === "in_progress" ? "primary" : "neutral"}>{TICKET_STATUS_LABEL[t.status]}</Badge></span>
                  </div>
                  <p className="mt-1 text-xs text-muted">ارسال {formatDateTime(t.createdAt)}</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7">{t.message}</p>
                  {t.messages.length > 0 && (
                    <ol className="mt-3 space-y-2 border-t border-border pt-3">
                      {t.messages.map((m) => (
                        <li key={m.id} className={m.kind === "reply" ? "rounded-md bg-primary-50 p-3 text-sm" : "text-xs text-muted"}>
                          {m.kind === "reply" && <p className="mb-1 text-xs text-muted">پاسخ پشتیبانی · {formatDateTime(m.createdAt)}</p>}
                          <p className="whitespace-pre-line leading-7">{m.body}</p>
                          {m.kind === "status" && <span> · {formatDateTime(m.createdAt)}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <Card className="h-fit">
          <CardHeader><CardTitle>درخواست جدید</CardTitle></CardHeader>
          <CardContent>
            <TicketForm
              kinds={[{ value: "support", label: "پشتیبانی و مشکل فنی" }, { value: "complaint", label: "شکایت" }, { value: "contact", label: "سؤال یا پیشنهاد" }]}
              defaults={{ name: profile.fullName ?? user.name, phone: user.phoneNumber ? toLocalPhone(user.phoneNumber) : undefined }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
