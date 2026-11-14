"use client";

import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { FormField, Textarea } from "@/components/ui";
import { createBookingAction } from "../actions/booking";

/** فرم تأیید نهایی رزرو؛ در صورت خطا (مثلاً پر شدن زمان) پیوند انتخاب زمان دیگر نمایش داده می‌شود */
export function BookingConfirmForm({ stylistId, serviceId, date, time, changeHref }: { stylistId: string; serviceId: string; date: string; time: string; changeHref: string }) {
  return (
    <ActionForm action={createBookingAction} submitLabel="ثبت نهایی نوبت" submitSize="lg">
      {(state) => (
        <>
          <input type="hidden" name="stylistId" value={stylistId} />
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="time" value={time} />
          <FormField id="note" label="توضیحات برای آرایشگر (اختیاری)" error={state.fieldErrors?.note}>
            <Textarea id="note" name="note" maxLength={500} placeholder="مثلاً حساسیت پوستی یا مدل مورد نظر" />
          </FormField>
          {state.status === "error" && (
            <Link href={changeHref} className="block text-sm text-primary-700 hover:underline">انتخاب زمان دیگر</Link>
          )}
        </>
      )}
    </ActionForm>
  );
}
