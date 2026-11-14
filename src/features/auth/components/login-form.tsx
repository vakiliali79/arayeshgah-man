"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { signInAction } from "../actions";
import type { AuthFormState, LoginInput } from "../schemas";
import { PasswordInput } from "./password-input";

const initialState: AuthFormState<LoginInput> = { status: "idle" };

export type LoginNotice = { tone: "success" | "warning" | "danger"; text: string };

export function LoginForm({ next, notice }: { next?: string; notice?: LoginNotice }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {notice && state.status === "idle" && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />

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

      <FormField id="password" label="رمز عبور" error={err.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          invalid={!!err.password}
          aria-describedby={err.password ? "password-error" : undefined}
          required
        />
      </FormField>

      <div className="-mt-2 text-start text-sm">
        <Link href={ROUTES.forgotPassword} className="text-primary-700 hover:underline">
          رمز عبور را فراموش کرده‌اید؟
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={pending}>
        ورود به حساب
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
