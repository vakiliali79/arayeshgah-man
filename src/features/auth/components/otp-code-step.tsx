"use client";

import { useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";
import type { OtpFormState } from "../schemas";
import { OtpCodeInput } from "./otp-code-input";

const RESEND_SECONDS = 60;

function formatLocal(phone: string) {
  return toPersianDigits(`${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`);
}

/**
 * مرحله دوم: نمایش شماره، ورود کد، ویرایش شماره و ارسال مجدد کد.
 * فرم تأیید و فرم ارسال مجدد هر دو مقادیر را به‌صورت hidden می‌فرستند و سرور دوباره اعتبارسنجی می‌کند.
 */
export function OtpCodeStep({
  values,
  sentAt,
  verifyAction,
  verifyState,
  verifying,
  resendAction,
  resending,
  onEdit,
  submitLabel,
  extraHidden,
}: {
  values: NonNullable<OtpFormState["values"]>;
  sentAt?: number;
  verifyAction: (fd: FormData) => void;
  verifyState: OtpFormState;
  verifying: boolean;
  resendAction: (fd: FormData) => void;
  resending: boolean;
  onEdit: () => void;
  submitLabel: string;
  extraHidden?: Record<string, string>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, RESEND_SECONDS - Math.floor((now - (sentAt ?? 0)) / 1000));
  const hidden = { phone: values.phone ?? "", ...extraHidden };
  const codeError = verifyState.fieldErrors?.code;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface-muted/60 p-4 text-center">
        <p className="text-sm text-muted">کد تأیید ۴ رقمی به این شماره ارسال شد:</p>
        <p dir="ltr" className="mt-1 text-xl font-bold tracking-wide" data-testid="otp-phone">
          {formatLocal(values.phone ?? "")}
        </p>
        <button type="button" onClick={onEdit} className="mt-2 text-sm font-medium text-primary-700 hover:underline">
          ویرایش شماره موبایل
        </button>
      </div>

      <form action={verifyAction} noValidate className="space-y-5">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {verifyState.status === "error" && (verifyState.message || codeError) && (
          <Alert tone="danger">{verifyState.message ?? codeError}</Alert>
        )}
        <OtpCodeInput invalid={verifyState.status === "error"} resetSignal={verifyState.status === "error" ? verifyState : undefined} />
        <Button type="submit" size="lg" fullWidth loading={verifying}>
          {submitLabel}
        </Button>
      </form>

      <form action={resendAction} className="text-center text-sm">
        {Object.entries({ ...hidden, terms: "on" }).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {remaining > 0 ? (
          <p className="text-muted">
            ارسال مجدد کد تا <span className="font-semibold text-foreground">{toPersianDigits(remaining)}</span> ثانیه دیگر
          </p>
        ) : (
          <button type="submit" disabled={resending} className="font-medium text-primary-700 hover:underline disabled:opacity-60">
            ارسال مجدد کد
          </button>
        )}
      </form>
    </div>
  );
}
