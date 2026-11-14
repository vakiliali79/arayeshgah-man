"use client";

import { FormField, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { submitTicketAction } from "../actions/contact";

const FIELD_HINT: Record<string, string> = { phone: "شماره موبایل معتبر نیست.", email: "ایمیل معتبر نیست.", name: "نام را وارد کنید (حداقل ۲ حرف).", subject: "موضوع را وارد کنید (حداقل ۳ حرف).", message: "متن پیام حداقل ۱۰ حرف باشد." };

/** فرم پیام (تماس با ما / پشتیبانی) */
export function TicketForm({ kinds, defaults }: { kinds: { value: string; label: string }[]; defaults?: { name?: string; phone?: string } }) {
  return (
    <ActionForm action={submitTicketAction} submitLabel="ارسال پیام" resetOnSuccess>
      {(state) => {
        const e = (k: string) => (state.fieldErrors?.[k] ? FIELD_HINT[k] : undefined);
        return (
          <>
            {kinds.length > 1 ? (
              <FormField id="kind" label="نوع پیام">
                <Select id="kind" name="kind">{kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>
              </FormField>
            ) : (
              <input type="hidden" name="kind" value={kinds[0]!.value} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="name" label="نام" error={e("name")}><Input id="name" name="name" defaultValue={defaults?.name} required minLength={2} maxLength={80} /></FormField>
              <FormField id="phone" label="شماره موبایل" error={e("phone")} hint="شماره یا ایمیل الزامی است"><Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={defaults?.phone} placeholder="09121234567" /></FormField>
            </div>
            <FormField id="email" label="ایمیل (اختیاری)" error={e("email")}><Input id="email" name="email" type="email" dir="ltr" maxLength={120} /></FormField>
            <FormField id="subject" label="موضوع" error={e("subject")}><Input id="subject" name="subject" required minLength={3} maxLength={120} /></FormField>
            <FormField id="message" label="متن پیام" error={e("message")}><Textarea id="message" name="message" required minLength={10} maxLength={4000} className="min-h-36" /></FormField>
          </>
        );
      }}
    </ActionForm>
  );
}
