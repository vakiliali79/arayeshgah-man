"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { SelfAssignableRole } from "@/config/roles";
import { ROUTES } from "@/config/routes";
import { requestRegisterOtpAction, verifyRegisterOtpAction } from "../actions";
import type { OtpFormState } from "../schemas";
import { OtpCodeStep } from "./otp-code-step";
import { PhoneInput } from "./phone-input";
import { RoleSelector } from "./role-selector";

const initial: OtpFormState = { step: "phone", status: "idle" };
type Draft = NonNullable<OtpFormState["values"]>;

function RegisterFlow({ defaultRole, draft, onEdit }: { defaultRole?: SelfAssignableRole; draft?: Draft; onEdit: (d: Draft) => void }) {
  const [requestState, requestAction, requesting] = useActionState(requestRegisterOtpAction, initial);
  const [verifyState, verifyAction, verifying] = useActionState(verifyRegisterOtpAction, { ...initial, step: "code" } as OtpFormState);

  const v = requestState.values ?? draft ?? {};
  const err = requestState.fieldErrors ?? {};

  if (requestState.step === "code" && requestState.values?.phone && verifyState.step !== "phone") {
    return (
      <OtpCodeStep
        values={requestState.values}
        sentAt={requestState.sentAt}
        verifyAction={verifyAction}
        verifyState={verifyState}
        verifying={verifying}
        resendAction={requestAction}
        resending={requesting}
        onEdit={() => onEdit(requestState.values!)}
        submitLabel="تأیید و ساخت حساب"
        extraHidden={{ fullName: requestState.values.fullName ?? "", role: requestState.values.role ?? "" }}
      />
    );
  }

  const describedBy = (k: keyof typeof err) => (err[k] ? `${k}-error` : undefined);
  const message = requestState.message ?? (verifyState.step === "phone" ? verifyState.message : undefined);

  return (
    <form action={requestAction} noValidate className="space-y-5">
      {message && <Alert tone="danger">{message}</Alert>}

      <RoleSelector defaultValue={(v.role as SelfAssignableRole) || defaultRole} error={err.role} />

      <FormField id="fullName" label="نام و نام خانوادگی" error={err.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="مثلاً سارا محمدی" defaultValue={v.fullName} invalid={!!err.fullName} aria-describedby={describedBy("fullName")} required />
      </FormField>

      <FormField id="phone" label="شماره موبایل" error={err.phone} hint="کد تأیید ۴ رقمی به این شماره ارسال می‌شود">
        <PhoneInput id="phone" name="phone" defaultValue={v.phone} invalid={!!err.phone} aria-describedby={describedBy("phone") ?? "phone-hint"} required />
      </FormField>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="terms" defaultChecked={!!draft} className="mt-1 size-4 accent-primary-700" />
          <span>
            <span className="text-primary-700">قوانین و مقررات</span> و <span className="text-primary-700">سیاست حریم خصوصی</span> آرایشگاه من را می‌پذیرم.
          </span>
        </label>
        {err.terms && <p role="alert" className="text-xs text-danger">{err.terms}</p>}
      </div>

      <Button type="submit" size="lg" fullWidth loading={requesting}>
        دریافت کد تأیید
      </Button>

      <p className="text-center text-sm text-muted">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link href={ROUTES.login} className="font-semibold text-primary-700 hover:underline">
          وارد شوید
        </Link>
      </p>
    </form>
  );
}

/** ثبت‌نام دومرحله‌ای: نام، نوع حساب و موبایل → کد OTP */
export function RegisterForm({ defaultRole }: { defaultRole?: SelfAssignableRole }) {
  const [attempt, setAttempt] = useState<{ key: number; draft?: Draft }>({ key: 0 });
  return (
    <RegisterFlow
      key={attempt.key}
      defaultRole={defaultRole}
      draft={attempt.draft}
      onEdit={(draft) => setAttempt((a) => ({ key: a.key + 1, draft }))}
    />
  );
}
