import { FormField, Input, Select, Textarea } from "@/components/ui";
import type { ServiceCategory } from "@/db/types";

/** فیلدهای مشترک فرم خدمت (سالن و آرایشگر مستقل) */
export function ServiceFields({
  categories,
  defaults,
}: {
  categories: { key: ServiceCategory; label: string }[];
  defaults?: { name?: string; category?: string; durationMinutes?: number; bufferMinutes?: number; priceToman?: number; description?: string | null };
}) {
  const d = defaults ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField id="name" label="نام خدمت"><Input id="name" name="name" defaultValue={d.name} required minLength={2} maxLength={120} /></FormField>
      <FormField id="category" label="دسته‌بندی">
        <Select id="category" name="category" defaultValue={d.category ?? categories[0]?.key}>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </Select>
      </FormField>
      <FormField id="priceToman" label="قیمت (تومان)"><Input id="priceToman" name="priceToman" type="number" dir="ltr" min={0} step={1000} defaultValue={d.priceToman} required /></FormField>
      <FormField id="durationMinutes" label="مدت (دقیقه)" hint="مضرب ۵ دقیقه"><Input id="durationMinutes" name="durationMinutes" type="number" dir="ltr" min={5} max={720} step={5} defaultValue={d.durationMinutes ?? 60} required /></FormField>
      <FormField id="bufferMinutes" label="زمان آماده‌سازی بعد از خدمت (دقیقه)"><Input id="bufferMinutes" name="bufferMinutes" type="number" dir="ltr" min={0} max={120} step={5} defaultValue={d.bufferMinutes ?? 0} /></FormField>
      <div className="sm:col-span-2">
        <FormField id="description" label="توضیحات (اختیاری)"><Textarea id="description" name="description" defaultValue={d.description ?? ""} maxLength={1000} className="min-h-20" /></FormField>
      </div>
    </div>
  );
}
