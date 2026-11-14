import type { Metadata } from "next";
import Image from "next/image";
import { ImageIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, FormField, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { deletePortfolioAction, uploadPortfolioAction } from "@/features/dashboard/actions/stylist";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { fileUrl } from "@/lib/files";
import { getStylistContext } from "@/server/dashboard/stylist-context";
import { listPortfolio } from "@/server/portfolio/service";

export const metadata: Metadata = { title: "نمونه‌کارها" };

export default async function StylistPortfolioPage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  const items = await listPortfolio(db, { stylistId: stylist.id }, false);
  return (
    <>
      <PageHeader title="نمونه‌کارها و گالری" description="تصاویر کارهای شما در صفحه عمومی‌تان نمایش داده می‌شود." />
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">افزودن نمونه‌کار</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={uploadPortfolioAction} submitLabel="بارگذاری" resetOnSuccess>
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label="تصویر نمونه‌کار" className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
            <FormField id="title" label="عنوان (اختیاری)"><Input id="title" name="title" maxLength={120} /></FormField>
          </ActionForm>
        </CardContent>
      </Card>
      {items.length === 0 ? (
        <EmptyState icon={<ImageIcon />} title="هنوز نمونه‌کاری اضافه نکرده‌اید" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <li key={it.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <Image src={fileUrl(it.fileId)!} alt={it.title ?? "نمونه‌کار"} width={400} height={400} unoptimized className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <span className="truncate">{it.title ?? "—"}</span>
                <ActionForm action={deletePortfolioAction} submitLabel="حذف" submitVariant="ghost" submitSize="sm" inline hideMessage confirmText="این نمونه‌کار حذف شود؟">
                  <input type="hidden" name="id" value={it.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
