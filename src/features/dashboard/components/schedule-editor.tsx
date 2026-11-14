import { ClockIcon } from "@/components/icons";
import { EmptyState, FormField, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import type { ActionState } from "@/server/actions/result";
import { formatClock, formatDateTime, IRAN_WEEK_ORDER, WEEKDAYS_FA } from "@/lib/format/datetime";
import { deleteHoursAction, deleteTimeOffAction } from "../actions/stylist";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export interface HoursRow {
  id: string;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  label?: string | null;
  editable?: boolean;
}

/** برنامه هفتگی (شنبه تا جمعه) + فرم افزودن شیفت */
export function HoursEditor({ rows, addAction, hidden, emptyText }: { rows: HoursRow[]; addAction?: Action; hidden?: Record<string, string>; emptyText: string }) {
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState icon={<ClockIcon />} title={emptyText} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {IRAN_WEEK_ORDER.flatMap((dow) =>
            rows
              .filter((r) => r.dayOfWeek === dow)
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{WEEKDAYS_FA[dow]}</span>
                  <span className="text-muted">
                    {formatClock(r.opensAt)} تا {formatClock(r.closesAt)}
                    {r.label ? ` · ${r.label}` : ""}
                  </span>
                  {r.editable !== false && (
                    <ActionForm action={deleteHoursAction} submitLabel="حذف" submitVariant="ghost" submitSize="sm" inline hideMessage confirmText="این شیفت حذف شود؟">
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  )}
                </li>
              )),
          )}
        </ul>
      )}
      {addAction && (
        <ActionForm action={addAction} submitLabel="افزودن شیفت" submitSize="sm" resetOnSuccess className="rounded-lg border border-border bg-surface p-4">
          {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="dayOfWeek" label="روز">
              <Select id="dayOfWeek" name="dayOfWeek" defaultValue="6">
                {IRAN_WEEK_ORDER.map((d) => <option key={d} value={d}>{WEEKDAYS_FA[d]}</option>)}
              </Select>
            </FormField>
            <FormField id="opensAt" label="از ساعت">
              <Input id="opensAt" name="opensAt" type="time" dir="ltr" defaultValue="10:00" required />
            </FormField>
            <FormField id="closesAt" label="تا ساعت">
              <Input id="closesAt" name="closesAt" type="time" dir="ltr" defaultValue="18:00" required />
            </FormField>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

export interface TimeOffRow {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  label?: string | null;
  editable?: boolean;
}

export function TimeOffEditor({ rows, addAction, hidden, tz }: { rows: TimeOffRow[]; addAction?: Action; hidden?: Record<string, string>; tz: string }) {
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">تعطیلی یا مرخصی پیش‌رویی ثبت نشده است.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{r.reason || "تعطیل"}{r.label ? ` · ${r.label}` : ""}</p>
                <p className="text-xs text-muted">از {formatDateTime(r.startsAt, tz)} تا {formatDateTime(r.endsAt, tz)}</p>
              </div>
              {r.editable !== false && (
                <ActionForm action={deleteTimeOffAction} submitLabel="حذف" submitVariant="ghost" submitSize="sm" inline hideMessage confirmText="این مورد حذف شود؟">
                  <input type="hidden" name="id" value={r.id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      {addAction && (
        <ActionForm action={addAction} submitLabel="ثبت تعطیلی" submitSize="sm" resetOnSuccess className="rounded-lg border border-border bg-surface p-4">
          {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="date" label="از تاریخ"><Input id="date" name="date" type="date" dir="ltr" required /></FormField>
            <FormField id="fromTime" label="ساعت شروع"><Input id="fromTime" name="fromTime" type="time" dir="ltr" defaultValue="00:00" /></FormField>
            <FormField id="endDate" label="تا تاریخ"><Input id="endDate" name="endDate" type="date" dir="ltr" required /></FormField>
            <FormField id="toTime" label="ساعت پایان"><Input id="toTime" name="toTime" type="time" dir="ltr" defaultValue="23:59" /></FormField>
          </div>
          <FormField id="reason" label="علت (اختیاری)"><Input id="reason" name="reason" maxLength={300} placeholder="مثلاً تعطیل رسمی یا مرخصی" /></FormField>
        </ActionForm>
      )}
    </div>
  );
}
