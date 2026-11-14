import type { Metadata } from "next";
import { FormField, Select } from "@/components/ui";
import { db } from "@/db";
import { addSalonHoursAction, addSalonTimeOffAction } from "@/features/dashboard/actions/salon";
import { HoursEditor, TimeOffEditor } from "@/features/dashboard/components/schedule-editor";
import { getSalonContext } from "@/server/dashboard/salon-context";
import { listSalonSchedule, listSalonStylists } from "@/server/salons/dashboard";

export const metadata: Metadata = { title: "برنامه کاری سالن" };

export default async function SalonSchedulePage({ params, searchParams }: PageProps<"/dashboard/salon/[salonId]/schedule">) {
  const { salonId } = await params;
  const { stylist: rawStylist } = await searchParams;
  const { salon, access } = await getSalonContext(salonId);
  const canManage = access.permissions.has("manage_schedule");
  const [{ salonHours, stylistHours, timeOff }, team] = await Promise.all([listSalonSchedule(db, salon.id), listSalonStylists(db, salon.id)]);
  const selected = team.find((t) => t.stylistId === rawStylist) ?? team[0];

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section className="space-y-3">
        <h2 className="font-bold">ساعات کاری سالن</h2>
        <HoursEditor rows={salonHours.map((h) => ({ ...h, editable: canManage }))} addAction={canManage ? addSalonHoursAction : undefined} hidden={{ salonId: salon.id }} emptyText="ساعات کاری سالن تعریف نشده است." />
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">شیفت آرایشگران</h2>
        {team.length === 0 ? (
          <p className="text-sm text-muted">ابتدا آرایشگران را از بخش «تیم» به سالن اضافه کنید.</p>
        ) : (
          <>
            <form className="flex items-end gap-2">
              <FormField id="stylist" label="آرایشگر">
                <Select id="stylist" name="stylist" defaultValue={selected?.stylistId}>{team.map((t) => <option key={t.stylistId} value={t.stylistId}>{t.name}</option>)}</Select>
              </FormField>
              <button type="submit" className="h-12 rounded-md border border-border px-4 text-sm hover:bg-surface-muted">نمایش</button>
            </form>
            <HoursEditor
              rows={stylistHours.filter((h) => h.stylistId === selected?.stylistId).map((h) => ({ ...h, editable: canManage }))}
              addAction={canManage ? addSalonHoursAction : undefined}
              hidden={{ salonId: salon.id, stylistId: selected?.stylistId ?? "" }}
              emptyText="برای این آرایشگر شیفتی در سالن تعریف نشده است."
            />
          </>
        )}
      </section>
      <section className="space-y-3 xl:col-span-2">
        <h2 className="font-bold">تعطیلی‌های سالن و مرخصی آرایشگران</h2>
        <TimeOffEditor
          rows={timeOff.map((t) => ({ ...t, label: t.stylistName, editable: canManage }))}
          addAction={canManage ? addSalonTimeOffAction : undefined}
          hidden={{ salonId: salon.id }}
          tz={salon.timezone}
        />
      </section>
    </div>
  );
}
