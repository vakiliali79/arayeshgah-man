"use client";

import { useEffect, useRef, useState } from "react";
import { cn, toLatinDigits } from "@/lib/utils";

/**
 * ورودی کد چهاررقمی: خانه‌های جدا، پرش خودکار، Backspace، Paste و ارقام فارسی.
 * مقدار نهایی در یک input مخفی با name="code" ارسال می‌شود.
 */
export function OtpCodeInput({
  length = 4,
  invalid,
  autoFocus = true,
  resetSignal,
}: {
  length?: number;
  invalid?: boolean;
  autoFocus?: boolean;
  /** با هر تغییر (مثلاً نتیجه جدید تأیید ناموفق) خانه‌ها پاک می‌شوند */
  resetSignal?: unknown;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // نتیجه جدید تأیید ناموفق → خانه‌ها پاک می‌شوند (الگوی React: به‌روزرسانی state هنگام تغییر prop در render)
  const [prevSignal, setPrevSignal] = useState(resetSignal);
  if (resetSignal !== prevSignal) {
    setPrevSignal(resetSignal);
    if (resetSignal !== undefined) setDigits(Array(length).fill(""));
  }
  useEffect(() => {
    if (resetSignal !== undefined) refs.current[0]?.focus();
  }, [resetSignal]);

  const setFrom = (start: number, raw: string) => {
    const chars = toLatinDigits(raw).replace(/\D/g, "").split("");
    if (chars.length === 0) return;
    setDigits((prev) => {
      const next = [...prev];
      chars.slice(0, length - start).forEach((c, i) => (next[start + i] = c));
      return next;
    });
    refs.current[Math.min(start + chars.length, length - 1)]?.focus();
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="code" value={digits.join("")} />
      <div dir="ltr" className="flex justify-center gap-3" role="group" aria-label="کد تأیید">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? "otp-0" : undefined}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && i === 0}
            maxLength={length}
            aria-label={`رقم ${i + 1}`}
            aria-invalid={invalid || undefined}
            className={cn(
              "size-14 rounded-md border bg-surface text-center text-2xl font-bold text-foreground transition-colors sm:size-16",
              "focus:outline-none focus:ring-4",
              invalid ? "border-danger focus:ring-danger/15" : "border-border focus:border-primary-400 focus:ring-primary-100",
            )}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setDigits((p) => p.map((x, j) => (j === i ? "" : x)));
                return;
              }
              setFrom(i, v.slice(-length));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              setFrom(i, e.clipboardData.getData("text"));
            }}
          />
        ))}
      </div>
    </div>
  );
}
