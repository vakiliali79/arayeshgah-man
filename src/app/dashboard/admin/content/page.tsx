import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, FormField, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { db } from "@/db";
import { settingAction } from "@/features/dashboard/actions/admin";
import { requireSession } from "@/server/auth/current";
import { getSetting } from "@/server/content/settings";

export const metadata: Metadata = { title: "محتوا و تنظیمات سایت" };

export default async function AdminContent() {
  await requireSession(["admin"]);
  const [contact, about, careers, announcement] = await Promise.all([getSetting(db, "contact"), getSetting(db, "about"), getSetting(db, "careers"), getSetting(db, "announcement")]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="محتوا و تنظیمات سایت" description="فقط اطلاعات واقعی وارد کنید؛ فیلدهای خالی در سایت به‌صورت «به‌زودی» یا پنهان نمایش داده می‌شوند." />
      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات تماس</CardTitle><CardDescription>در صفحات «تماس با ما»، «پشتیبانی» و فوتر نمایش داده می‌شود.</CardDescription></CardHeader>
        <CardContent>
          <ActionForm action={settingAction} submitLabel="ذخیره">
            <input type="hidden" name="key" value="contact" />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="c-phone" label="تلفن پشتیبانی"><Input id="c-phone" name="phone" dir="ltr" defaultValue={contact?.phone ?? ""} maxLength={30} /></FormField>
              <FormField id="c-email" label="ایمیل"><Input id="c-email" name="email" type="email" dir="ltr" defaultValue={contact?.email ?? ""} maxLength={120} /></FormField>
              <FormField id="c-hours" label="ساعات پاسخگویی"><Input id="c-hours" name="hours" defaultValue={contact?.hours ?? ""} maxLength={120} /></FormField>
              <FormField id="c-insta" label="اینستاگرام (نام کاربری)"><Input id="c-insta" name="instagram" dir="ltr" defaultValue={contact?.instagram ?? ""} maxLength={60} /></FormField>
              <FormField id="c-tg" label="تلگرام (نام کاربری)"><Input id="c-tg" name="telegram" dir="ltr" defaultValue={contact?.telegram ?? ""} maxLength={60} /></FormField>
              <div className="sm:col-span-2"><FormField id="c-addr" label="نشانی دفتر"><Input id="c-addr" name="address" defaultValue={contact?.address ?? ""} maxLength={300} /></FormField></div>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">متن صفحه «درباره ما»</CardTitle><CardDescription>پاراگراف‌ها را با خط خالی جدا کنید. اگر خالی باشد متن پیش‌فرض معرفی پلتفرم نمایش داده می‌شود.</CardDescription></CardHeader>
        <CardContent>
          <ActionForm action={settingAction} submitLabel="ذخیره">
            <input type="hidden" name="key" value="about" />
            <Textarea name="body" defaultValue={about?.body ?? ""} maxLength={6000} className="min-h-48" aria-label="متن درباره ما" />
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">فرصت‌های شغلی</CardTitle><CardDescription>هر خط یک موقعیت: عنوان | نوع همکاری | توضیح</CardDescription></CardHeader>
        <CardContent>
          <ActionForm action={settingAction} submitLabel="ذخیره">
            <input type="hidden" name="key" value="careers" />
            <FormField id="cr-intro" label="مقدمه"><Textarea id="cr-intro" name="intro" defaultValue={careers?.intro ?? ""} maxLength={2000} className="min-h-20" /></FormField>
            <FormField id="cr-open" label="موقعیت‌ها"><Textarea id="cr-open" name="openings" defaultValue={(careers?.openings ?? []).map((o) => [o.title, o.type ?? "", o.description ?? ""].join(" | ")).join("\n")} /></FormField>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعیه بالای سایت</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={settingAction} submitLabel="ذخیره">
            <input type="hidden" name="key" value="announcement" />
            <FormField id="an-text" label="متن اطلاعیه"><Input id="an-text" name="text" defaultValue={announcement?.text ?? ""} maxLength={200} /></FormField>
            <Checkbox name="active" defaultChecked={announcement?.active ?? false} label="نمایش اطلاعیه" />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
