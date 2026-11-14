import type { Metadata } from "next";
import Link from "next/link";
import { InboxIcon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, TabLinks } from "@/components/ui";
import { db } from "@/db";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { formatDateTime } from "@/lib/format/datetime";
import { TICKET_KIND_LABEL, TICKET_STATUS_LABEL } from "@/lib/format/labels";
import { toPersianDigits } from "@/lib/utils";
import { requireSession } from "@/server/auth/current";
import { listTickets, ticketCountsByStatus } from "@/server/support/service";

export const metadata: Metadata = { title: "پشتیبانی و شکایات" };
const STATUS_TABS = ["open", "in_progress", "resolved", "closed"] as const;

export default async function AdminTickets({ searchParams }: PageProps<"/dashboard/admin/tickets">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const status = STATUS_TABS.find((s) => s === param(sp, "status")) ?? (param(sp, "status") === "all" ? undefined : "open");
  const kind = param(sp, "kind");
  const q = param(sp, "q");
  const [rows, counts] = await Promise.all([listTickets(db, actor, { status, kind, q }), ticketCountsByStatus(db, actor)]);
  const href = (s: string) => `?status=${s}${kind ? `&kind=${kind}` : ""}`;
  return (
    <>
      <PageHeader title="پشتیبانی، تماس و شکایات" description="هر درخواست را باز کنید تا پاسخ، یادداشت داخلی و تغییر وضعیت را با تاریخچه ثبت کنید." />
      <TabLinks
        active={status ?? "all"}
        tabs={[...STATUS_TABS.map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s], href: href(s), count: counts[s] ?? 0 })), { key: "all", label: "همه", href: href("all") }]}
      />
      <FilterBar
        q={q}
        qPlaceholder="موضوع، نام، موبایل یا ایمیل"
        selects={[{ name: "kind", label: "نوع", value: kind, options: [{ value: "", label: "همه انواع" }, ...Object.entries(TICKET_KIND_LABEL).map(([value, label]) => ({ value, label }))] }]}
        hidden={{ status: status ?? "all" }}
      />
      {rows.length === 0 ? <EmptyState icon={<InboxIcon />} title="درخواستی در این دسته نیست" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/admin/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60">
                <div className="min-w-0">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.name}{t.userId ? " (کاربر واردشده)" : " (مهمان)"} · {formatDateTime(t.createdAt)}{t.messages ? ` · ${toPersianDigits(t.messages)} پیگیری` : ""}
                  </p>
                </div>
                <span className="flex gap-2"><Badge tone="primary">{TICKET_KIND_LABEL[t.kind]}</Badge><Badge tone={t.status === "open" ? "gold" : t.status === "in_progress" ? "primary" : "neutral"}>{TICKET_STATUS_LABEL[t.status]}</Badge></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
