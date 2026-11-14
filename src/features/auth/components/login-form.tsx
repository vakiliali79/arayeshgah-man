"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Button, FormField } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { requestLoginOtpAction, verifyLoginOtpAction } from "../actions";
import type { OtpFormState } from "../schemas";
import { OtpCodeStep } from "./otp-code-step";
import { PhoneInput } from "./phone-input";

export type LoginNotice = { tone: "success" | "warning" | "danger"; text: string };

const initial: OtpFormState = { step: "phone", status: "idle" };

function LoginFlow({ next, notice, initialPhone, onEdit }: { next?: string; notice?: LoginNotice; initialPhone?: string; onEdit: (phone?: string) => void }) {
  const [requestState, requestAction, requesting] = useActionState(requestLoginOtpAction, initial);
  const [verifyState, verifyAction, verifying] = useActionState(verifyLoginOtpAction, { ...initial, step: "code" } as OtpFormState);
  const err = requestState.fieldErrors ?? {};

  if (requestState.step === "code" && requestState.values?.phone) {
    return (
      <OtpCodeStep
        values={requestState.values}
        sentAt={requestState.sentAt}
        verifyAction={verifyAction}
        verifyState={verifyState}
        verifying={verifying}
        resendAction={requestAction}
        resending={requesting}
        onEdit={() => onEdit(requestState.values?.phone)}
        submitLabel="ورود به حساب"
        extraHidden={next ? { next } : undefined}
      />
    );
  }

  return (
    <form action={requestAction} noValidate className="space-y-5">
      {notice && requestState.status === "idle" && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {requestState.message && <Alert tone="danger">{requestState.message}</Alert>}

      <FormField id="phone" label="شماره موبایل" error={err.phone} hint="کد تأیید ۴ رقمی به این شماره ارسال می‌شود">
        <PhoneInput
          id="phone"
          name="phone"
          defaultValue={requestState.values?.phone ?? initialPhone}
          invalid={!!err.phone}
          aria-describedby={err.phone ? "phone-error" : "phone-hint"}
          autoFocus
          required
        />
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={requesting}>
        دریافت کد ورود
      </Button>

      <p className="text-center text-sm text-muted">
        حساب کاربری ندارید؟{" "}
        <Link href={ROUTES.register} className="font-semibold text-primary-700 hover:underline">
          ثبت‌نام کنید
        </Link>
      </p>
    </form>
  );
}

/** ورود دومرحله‌ای: شماره موبایل → کد OTP. «ویرایش شماره» فرم را از نو و با همان شماره شروع می‌کند. */
export function LoginForm({ next, notice }: { next?: string; notice?: LoginNotice }) {
  const [attempt, setAttempt] = useState({ key: 0, phone: undefined as string | undefined });
  return (
    <LoginFlow
      key={attempt.key}
      next={next}
      notice={attempt.key === 0 ? notice : undefined}
      initialPhone={attempt.phone}
      onEdit={(phone) => setAttempt((a) => ({ key: a.key + 1, phone }))}
    />
  );
}
