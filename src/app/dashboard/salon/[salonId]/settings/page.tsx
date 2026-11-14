import type { Metadata } from "next";
import Image from "next/image";
import { ImageIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, FormField, Input } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { updateSalonAction, uploadSalonCoverAction } from "@/features/dashboard/actions/salon";
import { deletePortfolioAction, uploadPortfolioAction } from "@/features/dashboard/actions/stylist";
import { SalonFields } from "@/features/dashboard/components/salon-fields";
import { fileUrl } from "@/lib/files";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listPortfolio } from "@/server/portfolio/service";

export const metadata: Metadata = { title: "اطلاعات و تصاویر سالن" };

const fileInput = "block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700";

export default async function SalonSettingsPage({ params }: PageProps<"/dashboard/salon/[salonId]/settings">) {
  const { salonId } = await params;
  const { salon, access } = await getSalonContext(salonId);
  const canEdit = access.permissions.has("manage_salon");
  const canGallery = access.permissions.has("manage_portfolio");
  const gallery = await listPortfolio(db, { salonId: salon.id }, false);
  const cover = fileUrl(salon.coverFileId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">اطلاعات سالن</CardTitle>
          <CardDescription>نشانی صفحه: <span dir="ltr">/salons/{salon.slug}</span></CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <ActionForm action={updateSalonAction} submitLabel="ذخیره اطلاعات">
              <input type="hidden" name="salonId" value={salon.id} />
              <SalonFields d={salon} />
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">برای ویرایش به مجوز «ویرایش اطلاعات سالن» نیاز دارید.</p>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">تصویر کاور</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cover && <Image src={cover} alt={`کاور ${salon.name}`} width={900} height={400} unoptimized className="aspect-[9/4] w-full rounded-md object-cover" />}
            <ActionForm action={uploadSalonCoverAction} submitLabel="بارگذاری کاور" submitSize="sm">
              <input type="hidden" name="salonId" value={salon.id} />
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required aria-label="تصویر کاور" className={fileInput} />
            </ActionForm>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">گالری و نمونه‌کارهای سالن</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canGallery && (
            <ActionForm action={uploadPortfolioAction} submitLabel="افزودن تصویر" submitSize="sm" resetOnSuccess>
              <input type="hidden" name="salonId" value={salon.id} />
              <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required aria-label="تصویر گالری" className={fileInput} />
              <FormField id="title" label="عنوان (اختیاری)"><Input id="title" name="title" maxLength={120} /></FormField>
            </ActionForm>
          )}
          {gallery.length === 0 ? (
            <EmptyState icon={<ImageIcon />} title="تصویری در گالری نیست" />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((g) => (
                <li key={g.id} className="overflow-hidden rounded-md border border-border">
                  <Image src={fileUrl(g.fileId)!} alt={g.title ?? "تصویر سالن"} width={300} height={300} unoptimized className="aspect-square w-full object-cover" />
                  {canGallery && (
                    <ActionForm action={deletePortfolioAction} submitLabel="حذف" submitVariant="ghost" submitSize="sm" inline hideMessage confirmText="این تصویر حذف شود؟" className="p-1">
                      <input type="hidden" name="id" value={g.id} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
