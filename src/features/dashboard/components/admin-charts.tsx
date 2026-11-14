import { toPersianDigits } from "@/lib/utils";

const fa = (n: number) => toPersianDigits(n.toLocaleString("en-US"));

export interface ChartPoint {
  /** برچسب کامل (برای راهنما و جدول) */
  label: string;
  /** برچسب کوتاه محور */
  short: string;
  value: number;
}

/** اعداد گرد برای خط مرجع بالای محور */
function niceMax(max: number) {
  if (max <= 4) return Math.max(1, max);
  const p = 10 ** Math.floor(Math.log10(max));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * نمودار ستونی تک‌سری در طول زمان (یک رنگ؛ عنوان نام سری است).
 * هر ستون با hover/focus راهنمای مقدار دارد؛ جدول داده برای صفحه‌خوان و نمایش متنی موجود است.
 */
export function TimeBarChart({ title, unit, points, total }: { title: string; unit: string; points: ChartPoint[]; total?: number }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const sum = total ?? points.reduce((a, p) => a + p.value, 0);
  // حداکثر ۴ برچسب محور (اول، میانی‌ها، آخر) تا در موبایل هم روی هم نیفتند
  const n = points.length;
  const tickIdx = n <= 4 ? points.map((_, i) => i) : [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])];
  return (
    <figure className="rounded-lg border border-border bg-surface p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted">مجموع بازه: <strong className="text-foreground">{fa(sum)}</strong> {unit}</span>
      </figcaption>
      {sum === 0 ? (
        <p className="py-10 text-center text-sm text-muted">در این بازه داده‌ای ثبت نشده است.</p>
      ) : (
        <div className="relative" aria-hidden="true">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 text-[0.65rem] text-muted">
            <span className="shrink-0">{fa(max)}</span>
            <span className="h-px flex-1 border-t border-dashed border-border" />
          </div>
          <div className="flex h-40 items-end gap-[2px] border-b border-border pt-4" dir="ltr">
            {points.map((p) => (
              <div key={p.label} tabIndex={0} className="group relative flex h-full min-w-0 flex-1 items-end outline-none">
                <div
                  className="w-full rounded-t-[4px] bg-primary-500 transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                  style={{ height: p.value === 0 ? 0 : `max(2px, ${(p.value / max) * 100}%)` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[0.7rem] text-surface shadow-lift group-hover:block group-focus:block" dir="rtl">
                  {p.label}: {fa(p.value)} {unit}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[0.65rem] text-muted" dir="ltr">
            {tickIdx.map((i) => (
              <span
                key={i}
                className="absolute top-0 whitespace-nowrap"
                style={{ left: `${((i + 0.5) / n) * 100}%`, transform: i === 0 ? "translateX(-25%)" : i === n - 1 ? "translateX(-75%)" : "translateX(-50%)" }}
              >
                {points[i]!.short}
              </span>
            ))}
          </div>
        </div>
      )}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-foreground">نمایش جدول داده</summary>
        <table className="mt-2 w-full text-start">
          <thead><tr className="text-muted"><th className="py-1 text-start font-normal">بازه</th><th className="py-1 text-start font-normal">{unit}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.label} className="border-t border-border"><td className="py-1">{p.label}</td><td className="py-1">{fa(p.value)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

/** میله‌های افقی با برچسب مستقیم (هویت با متن، نه رنگ) — برای تفکیک وضعیت‌ها */
export function LabeledBars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="rounded-lg border border-border bg-surface p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted">مجموع: <strong className="text-foreground">{fa(total)}</strong></span>
      </figcaption>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">در این بازه نوبتی ثبت نشده است.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${fa(r.value)}`}>
              <span className="truncate">{r.label}</span>
              <span className="h-3 rounded-full bg-surface-muted">
                <span className="block h-3 rounded-full bg-primary-500" style={{ width: r.value === 0 ? 0 : `max(4px, ${(r.value / max) * 100}%)` }} />
              </span>
              <span className="tabular-nums text-muted">{fa(r.value)} <span className="text-[0.7rem]">({toPersianDigits(Math.round((r.value / total) * 100))}٪)</span></span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
