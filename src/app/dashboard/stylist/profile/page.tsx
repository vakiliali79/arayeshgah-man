import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, Checkbox, FormField, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { uploadAvatarAction } from "@/features/dashboard/actions/customer";
import { updateStylistProfileAction } from "@/features/dashboard/actions/stylist";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { getStylistContext } from "@/server/dashboard/stylist-context";

export const metadata: Metadata = { title: "پروفایل حرفه‌ای" };

export default async function StylistProfilePage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold sm:text-2xl">پروفایل حرفه‌ای</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات نمایش‌داده‌شده به مشتریان</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={updateStylistProfileAction} submitLabel="ذخیره پروفایل">
            {(state) => (
              <>
                <FormField id="displayName" label="نام نمایشی" error={state.fieldErrors?.displayName}>
                  <Input id="displayName" name="displayName" defaultValue={stylist.displayName} required minLength={2} maxLength={80} />
                </FormField>
                <FormField id="slug" label="نشانی صفحه شما" hint={`arayeshgahman.ir/stylists/… — فقط حروف انگلیسی کوچک، عدد و خط تیره`} error={state.fieldErrors?.slug}>
                  <Input id="slug" name="slug" dir="ltr" defaultValue={stylist.slug} minLength={3} maxLength={60} />
                </FormField>
                <FormField id="specialties" label="تخصص‌ها و مهارت‌ها" hint="با ویرگول جدا کنید">
                  <Input id="specialties" name="specialties" defaultValue={stylist.specialties.join("، ")} maxLength={400} />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField id="yearsExperience" label="سابقه (سال)" error={state.fieldErrors?.yearsExperience}>
                    <Input id="yearsExperience" name="yearsExperience" type="number" dir="ltr" min={0} max={70} defaultValue={stylist.yearsExperience ?? ""} />
                  </FormField>
                  <FormField id="city" label="شهر"><Input id="city" name="city" defaultValue={stylist.city ?? ""} maxLength={60} /></FormField>
                  <FormField id="district" label="منطقه"><Input id="district" name="district" defaultValue={stylist.district ?? ""} maxLength={60} /></FormField>
                </div>
                <FormField id="bio" label="معرفی"><Textarea id="bio" name="bio" defaultValue={stylist.bio ?? ""} maxLength={1000} /></FormField>
                <Checkbox name="acceptsIndependentBookings" defaultChecked={stylist.acceptsIndependentBookings} label="خارج از سالن هم به‌صورت مستقل نوبت می‌پذیرم" />
              </>
            )}
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">تصویر پروفایل</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={uploadAvatarAction} submitLabel="بارگذاری تصویر" submitSize="sm">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
