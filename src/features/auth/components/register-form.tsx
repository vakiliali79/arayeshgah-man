"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { SelfAssignableRole } from "@/config/roles";
import { ROUTES } from "@/config/routes";
import { signUpAction } from "../actions";
import type { AuthFormState, RegisterInput } from "../schemas";
import { PasswordInput } from "./password-input";
import { RoleSelector } from "./role-selector";

const initialState: AuthFormState<RegisterInput> = { status: "idle" };

export function RegisterForm({ defaultRole }: { defaultRole?: SelfAssignableRole }) {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const err = state.fieldErrors ?? {};
  const v = state.values ?? {};

  if (state.status === "success") {
    return (
      <div className="space-y-5">
        <Alert tone="success">{state.message}</Alert>
        <Link href={ROUTES.login} className="block text-center text-sm font-semibold text-primary-700 hover:underline">
          رفتن به صفحه ورود
        </Link>
      </div>
    );
  }

  const describedBy = (k: keyof RegisterInput) => (err[k] ? `${k}-error` : undefined);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <RoleSelector defaultValue={(v.role as SelfAssignableRole) ?? defaultRole} error={err.role} />

      <FormField id="fullName" label="نام و نام خانوادگی" error={err.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" placeholder="مثلاً سارا محمدی" defaultValue={v.fullName} invalid={!!err.fullName} aria-describedby={describedBy("fullName")} required />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="phone" label="شماره موبایل" error={err.phone}>
          <Input id="phone" name="phone" type="tel" dir="ltr" inputMode="numeric" autoComplete="tel" placeholder="09121234567" defaultValue={v.phone} invalid={!!err.phone} aria-describedby={describedBy("phone")} required />
        </FormField>
        <FormField id="email" label="ایمیل" error={err.email}>
          <Input id="email" name="email" type="email" dir="ltr" inputMode="email" autoComplete="email" placeholder="name@example.com" defaultValue={v.email} invalid={!!err.email} aria-describedby={describedBy("email")} required />
        </FormField>
      </div>

      <FormField id="password" label="رمز عبور" error={err.password} hint="حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد">
        <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="••••••••" invalid={!!err.password} aria-describedby={describedBy("password") ?? "password-hint"} required />
      </FormField>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="terms" className="mt-1 size-4 accent-primary-700" />
          <span>
            <span className="text-primary-700">قوانین و مقررات</span> و <span className="text-primary-700">سیاست حریم خصوصی</span> آرایشگاه من را می‌پذیرم.
          </span>
        </label>
        {err.terms && <p role="alert" className="text-xs text-danger">{err.terms}</p>}
      </div>

      <Button type="submit" size="lg" fullWidth loading={pending}>
        ساخت حساب کاربری
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
