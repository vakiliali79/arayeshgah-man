import type { Metadata } from "next";
import { FileTextIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { AUDIT_TARGET_LABEL, AuditHistory } from "@/features/dashboard/components/admin-ui";
import { FilterBar, param } from "@/features/dashboard/components/filter-bar";
import { Pagination } from "@/features/public/components/search-filters";
import { toPersianDigits } from "@/lib/utils";
import { AUDIT_PAGE_SIZE, listAuditLogs } from "@/server/admin/audit";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "تاریخچه اقدامات مدیریتی" };

export default async function AdminAudit({ searchParams }: PageProps<"/dashboard/admin/audit">) {
  const { actor } = await requireSession(["admin"]);
  const sp = await searchParams;
  const targetType = param(sp, "targetType");
  const page = Math.max(1, Number(param(sp, "page")) || 1);
  const { rows, total } = await listAuditLogs(db, actor, { targetType: targetType && targetType in AUDIT_TARGET_LABEL ? targetType : undefined, page });
  return (
    <>
      <PageHeader title="تاریخچه اقدامات مدیریتی" description={`${toPersianDigits(total)} اقدام ثبت‌شده. این تاریخچه فقط افزودنی است و در دیتابیس قابل ویرایش یا حذف نیست.`} />
      <FilterBar
        selects={[{ name: "targetType", label: "بخش", value: targetType, options: [{ value: "", label: "همه بخش‌ها" }, ...Object.entries(AUDIT_TARGET_LABEL).map(([value, label]) => ({ value, label }))] }]}
        resetHref="/dashboard/admin/audit"
      />
      {rows.length === 0 ? <EmptyState icon={<FileTextIcon />} title="اقدامی ثبت نشده است" /> : <AuditHistory rows={rows} showTarget />}
      <Pagination total={total} page={page} pageSize={AUDIT_PAGE_SIZE} basePath="/dashboard/admin/audit" params={sp} />
    </>
  );
}
