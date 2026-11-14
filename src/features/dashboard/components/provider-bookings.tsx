import { CalendarIcon, PhoneIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { providerBookingAction } from "../actions/provider";
import { BookingCard, type BookingCardData } from "./booking-card";

type Row = BookingCardData & { customerPhone: string | null; customerNote: string | null; endsAt: Date };

function Op({ id, op, label, variant, confirm }: { id: string; op: string; label: string; variant?: "primary" | "outline" | "danger" | "secondary"; confirm?: string }) {
  return (
    <ActionForm action={providerBookingAction} submitLabel={label} submitVariant={variant} submitSize="sm" inline hideMessage confirmText={confirm}>
      <input type="hidden" name="bookingId" value={id} />
      <input type="hidden" name="op" value={op} />
    </ActionForm>
  );
}

/** فهرست نوبت‌ها برای آرایشگر/سالن با عملیات مجاز هر وضعیت (مجوز نهایی در سرور) */
export function ProviderBookingList({ rows, empty, now }: { rows: Row[]; empty: string; now: Date }) {
  if (rows.length === 0) return <EmptyState icon={<CalendarIcon />} title={empty} />;
  return (
    <div className="space-y-3">
      {rows.map((b) => {
        const started = b.startsAt <= now;
        return (
          <BookingCard
            key={b.id}
            b={b}
            actions={
              <>
                {b.customerPhone && (
                  <a href={`tel:${b.customerPhone}`} className="me-auto flex items-center gap-1.5 text-sm text-primary-700 hover:underline" dir="ltr">
                    <PhoneIcon size={15} /> {b.customerPhone}
                  </a>
                )}
                {b.customerNote && <p className="w-full text-sm text-muted">توضیح مشتری: {b.customerNote}</p>}
                {b.status === "pending" && !started && (
                  <>
                    <Op id={b.id} op="confirm" label="تأیید" />
                    <Op id={b.id} op="reject" label="رد" variant="outline" confirm="این نوبت رد شود؟" />
                  </>
                )}
                {b.status === "confirmed" && started && (
                  <>
                    <Op id={b.id} op="complete" label="انجام شد" />
                    <Op id={b.id} op="no_show" label="مشتری نیامد" variant="outline" confirm="عدم حضور مشتری ثبت شود؟" />
                  </>
                )}
                {b.status === "confirmed" && !started && <Op id={b.id} op="cancel" label="لغو نوبت" variant="outline" confirm="این نوبت لغو شود؟ مشتری مطلع می‌شود." />}
              </>
            }
          />
        );
      })}
    </div>
  );
}
