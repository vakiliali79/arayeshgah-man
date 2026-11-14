"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/server/actions/result";
import { cn } from "@/lib/utils";
import { Alert } from "./alert";
import { Button, type ButtonProps } from "./button";

/**
 * فرم عمومی متصل به Server Action با وضعیت در حال ارسال، پیام موفقیت/خطا و خطای فیلدها.
 * فیلدها از طریق children (یا تابع با دسترسی به state) ساخته می‌شوند.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitVariant,
  submitSize = "md",
  className,
  hideMessage,
  resetOnSuccess,
  confirmText,
  inline,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children?: ReactNode | ((state: ActionState) => ReactNode);
  submitLabel: string;
  submitVariant?: ButtonProps["variant"];
  submitSize?: ButtonProps["size"];
  className?: string;
  hideMessage?: boolean;
  resetOnSuccess?: boolean;
  /** پرسش تأیید قبل از ارسال (برای اعمال حساس مثل لغو یا حذف) */
  confirmText?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "space-y-4", className)}
    >
      {!hideMessage && state.message && (
        <Alert tone={state.status === "success" ? "success" : "danger"} className={inline ? "w-full" : undefined}>
          {state.message}
        </Alert>
      )}
      {typeof children === "function" ? children(state) : children}
      <Button type="submit" loading={pending} variant={submitVariant} size={submitSize}>
        {submitLabel}
      </Button>
      {hideMessage && state.status === "error" && state.message && <span className="text-xs text-danger" role="alert">{state.message}</span>}
    </form>
  );
}
