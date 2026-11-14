"use client";

import { Checkbox, FormField, Input, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { updateProfileAction } from "../actions/customer";
import { updateStylistProfileAction } from "../actions/stylist";

/** فرم‌هایی که خطای فیلدها را از state نمایش می‌دهند باید کامپوننت کلاینت باشند */
export function CustomerProfileForm({ fullName, phone, city }: { fullName: string; phone: string; city: string }) {
  return (
          <ActionForm action={updateProfileAction} submitLabel="ذخیره تغییرات">
            {(state) => (
              <>
                <FormField id="fullName" label="نام و نام خانوادگی" error={state.fieldErrors?.fullName}>
                  <Input id="fullName" name="fullName" defaultValue={fullName} maxLength={80} required />
                </FormField>
                <FormField id="phone" label="شماره تماس" hint="برای هماهنگی نوبت (می‌تواند با موبایل ورود متفاوت باشد)" error={state.fieldErrors?.phone}>
                  <Input id="phone" name="phone" type="tel" dir="ltr" inputMode="tel" defaultValue={phone} placeholder="09121234567" />
                </FormField>
                <FormField id="city" label="شهر" error={state.fieldErrors?.city}>
                  <Input id="city" name="city" defaultValue={city} maxLength={60} />
                </FormField>
              </>
            )}
          </ActionForm>
  );
}

export interface StylistProfileDefaults {
  displayName: string;
  slug: string;
  specialties: string[];
  yearsExperience: number | null;
  city: string | null;
  district: string | null;
  bio: string | null;
  acceptsIndependentBookings: boolean;
}

export function StylistProfileForm({ stylist }: { stylist: StylistProfileDefaults }) {
  return (
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
  );
}
