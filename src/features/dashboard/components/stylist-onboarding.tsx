import { Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, FormField, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { createStylistProfileAction } from "../actions/stylist";

/** ساخت پروفایل حرفه‌ای (اولین ورود آرایشگر) */
export function StylistOnboarding() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>پروفایل حرفه‌ای خود را بسازید</CardTitle>
        <CardDescription>برای دریافت نوبت، معرفی خدمات و عضویت در سالن‌ها ابتدا پروفایل آرایشگری بسازید.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={createStylistProfileAction} submitLabel="ساخت پروفایل">
          <FormField id="displayName" label="نام نمایشی"><Input id="displayName" name="displayName" required minLength={2} maxLength={80} /></FormField>
          <FormField id="specialties" label="تخصص‌ها" hint="با ویرگول جدا کنید؛ مثلاً: رنگ مو، کوتاهی، میکاپ"><Input id="specialties" name="specialties" maxLength={400} /></FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="yearsExperience" label="سابقه (سال)"><Input id="yearsExperience" name="yearsExperience" type="number" dir="ltr" min={0} max={70} /></FormField>
            <FormField id="city" label="شهر"><Input id="city" name="city" maxLength={60} /></FormField>
            <FormField id="district" label="منطقه"><Input id="district" name="district" maxLength={60} /></FormField>
          </div>
          <FormField id="bio" label="معرفی کوتاه"><Textarea id="bio" name="bio" maxLength={1000} /></FormField>
          <Checkbox name="acceptsIndependentBookings" label="خارج از سالن هم به‌صورت مستقل نوبت می‌پذیرم" />
        </ActionForm>
      </CardContent>
    </Card>
  );
}
