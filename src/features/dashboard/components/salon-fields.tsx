import { FormField, Input, Textarea } from "@/components/ui";

interface SalonDefaults {
  name?: string;
  slug?: string;
  city?: string;
  district?: string | null;
  address?: string;
  phone?: string | null;
  description?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}

/** فیلدهای فرم ساخت/ویرایش سالن */
export function SalonFields({ d = {}, withSlug }: { d?: SalonDefaults; withSlug?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField id="name" label="نام سالن"><Input id="name" name="name" defaultValue={d.name} required minLength={2} maxLength={120} /></FormField>
      {withSlug && (
        <FormField id="slug" label="نشانی صفحه سالن" hint="حروف انگلیسی کوچک، عدد و خط تیره؛ بعداً قابل تغییر نیست">
          <Input id="slug" name="slug" dir="ltr" required placeholder="rose-gold" maxLength={80} />
        </FormField>
      )}
      <FormField id="city" label="شهر"><Input id="city" name="city" defaultValue={d.city} required minLength={2} maxLength={60} /></FormField>
      <FormField id="district" label="منطقه / محله"><Input id="district" name="district" defaultValue={d.district ?? ""} maxLength={60} /></FormField>
      <div className="sm:col-span-2">
        <FormField id="address" label="نشانی کامل"><Input id="address" name="address" defaultValue={d.address} required minLength={5} maxLength={300} /></FormField>
      </div>
      <FormField id="phone" label="تلفن سالن" hint="۱۱ رقم، مثلاً 02122000000"><Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={d.phone ?? ""} maxLength={11} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="latitude" label="عرض جغرافیایی"><Input id="latitude" name="latitude" dir="ltr" inputMode="decimal" defaultValue={d.latitude ?? ""} placeholder="35.7" /></FormField>
        <FormField id="longitude" label="طول جغرافیایی"><Input id="longitude" name="longitude" dir="ltr" inputMode="decimal" defaultValue={d.longitude ?? ""} placeholder="51.4" /></FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField id="description" label="معرفی سالن"><Textarea id="description" name="description" defaultValue={d.description ?? ""} maxLength={2000} /></FormField>
      </div>
    </div>
  );
}
