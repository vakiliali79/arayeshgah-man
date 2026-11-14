"use client";

import { useActionState } from "react";
import { Alert, Button, FormField } from "@/components/ui";
import { resetPasswordAction } from "../actions";
import type { AuthFormState, ResetPasswordInput } from "../schemas";
import { PasswordInput } from "./password-input";

const initialState: AuthFormState<ResetPasswordInput> = { status: "idle" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5">
      {(state.message || err.token) && <Alert tone="danger">{state.message ?? err.token}</Alert>}
      <input type="hidden" name="token" value={token} />

      <FormField id="password" label="رمز عبور جدید" error={err.password} hint="حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد">
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          invalid={!!err.password}
          aria-describedby={err.password ? "password-error" : "password-hint"}
          required
        />
      </FormField>

      <FormField id="confirmPassword" label="تکرار رمز عبور جدید" error={err.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          invalid={!!err.confirmPassword}
          aria-describedby={err.confirmPassword ? "confirmPassword-error" : undefined}
          required
        />
      </FormField>

      <Button type="submit" size="lg" fullWidth loading={pending}>
        ذخیره رمز عبور جدید
      </Button>
    </form>
  );
}
