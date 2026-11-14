"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { requestPasswordResetAction, resendVerificationAction } from "../actions";
import type { AuthFormState, ForgotPasswordInput } from "../schemas";

const initialState: AuthFormState<ForgotPasswordInput> = { status: "idle" };

/** فرم یک‌فیلدی ایمیل؛ برای «فراموشی رمز» و «ارسال مجدد لینک تأیید» */
export function EmailRequestForm({ mode, submitLabel }: { mode: "password-reset" | "verification"; submitLabel: string }) {
  const action = mode === "password-reset" ? requestPasswordResetAction : resendVerificationAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const err = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <Alert tone="success">{state.message}</Alert>
        <Link href={ROUTES.login} className="block text-center text-sm font-semibold text-primary-700 hover:underline">
          بازگشت به صفحه ورود
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <FormField id="email" label="ایمیل" error={err.email}>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          defaultValue={state.values?.email}
          invalid={!!err.email}
          aria-describedby={err.email ? "email-error" : undefined}
          required
        />
      </FormField>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {submitLabel}
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href={ROUTES.login} className="font-semibold text-primary-700 hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </form>
  );
}
