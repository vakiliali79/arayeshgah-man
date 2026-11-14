import type { Metadata } from "next";
import { InboxIcon } from "@/components/icons";
import { Badge, EmptyState, FormField, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { ticketAction } from "@/features/dashboard/actions/admin";
import { FilterBar } from "@/features/dashboard/components/filter-bar";
import { formatDateTime } from "@/lib/format/datetime";
import { TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from "@/lib/format/labels";
import { requireSession } from "@/server/auth/current";
import { listTickets } from "@/server/support/service";

export const metadata: Metadata = { title: "پیام‌ها و شکایات" };

export default async function AdminTickets({ searchParams }: PageProps<"/dashboard/admin/tickets">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  const rows = await listTickets(db, actor, { status, kind });
  return (
    <>
      <PageHeader title="پیام‌ها، پشتیبانی و شکایات" />
      <FilterBar
        selects={[
          { name: "status", value: status, options: [{ value: "", label: "همه وضعیت‌ها" }, ...Object.entries(TICKET_STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
          { name: "kind", value: kind, options: [{ value: "", label: "همه انواع" }, ...Object.entries(TICKET_KIND_LABEL).map(([value, label]) => ({ value, label }))] },
        ]}
      />
      {rows.length === 0 ? <EmptyState icon={<InboxIcon />} title="پیامی وجود ندارد" /> : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{t.subject}</p>
                <div className="flex gap-2"><Badge tone="primary">{TICKET_KIND_LABEL[t.kind]}</Badge><Badge tone={t.status === "open" ? "gold" : "neutral"}>{TICKET_STATUS_LABEL[t.status]}</Badge></div>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t.name}{t.phone ? <> · <a href={`tel:${t.phone}`} dir="ltr">{t.phone}</a></> : null}{t.email ? <> · <a href={`mailto:${t.email}`} dir="ltr">{t.email}</a></> : null} · {formatDateTime(t.createdAt)}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7">{t.message}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-primary-700">پیگیری</summary>
                <ActionForm action={ticketAction} submitLabel="ذخیره" submitSize="sm" className="mt-2">
                  <input type="hidden" name="ticketId" value={t.id} />
                  <FormField id={`s-${t.id}`} label="وضعیت">
                    <Select id={`s-${t.id}`} name="status" defaultValue={t.status}>{Object.entries(TICKET_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                  </FormField>
                  <FormField id={`n-${t.id}`} label="یادداشت داخلی"><Textarea id={`n-${t.id}`} name="adminNote" defaultValue={t.adminNote ?? ""} maxLength={2000} className="min-h-20" /></FormField>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
