"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { Input, type InputProps } from "@/components/ui";

export function PasswordInput(props: Omit<InputProps, "type" | "endAdornment">) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      dir="ltr"
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
          aria-pressed={visible}
          className="flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      }
    />
  );
}
