"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BellIcon, LogoutIcon, MenuIcon, XIcon } from "@/components/icons";
import { Avatar, Badge, Logo } from "@/components/ui";
import { toPersianDigits } from "@/lib/utils";
import { signOutAction } from "@/features/auth/actions";
import type { NavItem } from "./nav-config";
import { NavLinks } from "./nav-links";

export interface ShellSection {
  key: string;
  label: string;
  items: NavItem[];
}

export interface ShellUser {
  name: string;
  roleLabel: string;
  unread: number;
}

/** لینک اعلان‌ها با شمارنده خوانده‌نشده */
function BellLink({ unread, onNavigate, className }: { unread: number; onNavigate?: () => void; className?: string }) {
  return (
    <Link
      href="/dashboard/customer/notifications"
      onClick={onNavigate}
      aria-label={unread ? `اعلان‌ها (${toPersianDigits(unread)} خوانده‌نشده)` : "اعلان‌ها"}
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-surface-muted ${className ?? ""}`}
    >
      <BellIcon />
      {unread > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-white" aria-hidden>
          {unread > 99 ? "+۹۹" : toPersianDigits(unread)}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ sections, user, onNavigate }: { sections: ShellSection[]; user: ShellUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex shrink-0 items-center gap-3 rounded-lg bg-surface-muted/70 p-3">
        <Avatar name={user.name} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <Badge tone="gold" className="mt-1">{user.roleLabel}</Badge>
        </div>
        <BellLink unread={user.unread} onNavigate={onNavigate} />
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto" aria-label="منوی داشبورد">
        {sections.map((s) => (
          <div key={s.key} className="space-y-2">
            <p className="px-3 text-xs font-semibold text-gold-600">{s.label}</p>
            <NavLinks items={s.items} onNavigate={onNavigate} />
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-1 border-t border-border pt-4">
        <Link href="/" className="block rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-muted hover:text-foreground">
          بازگشت به سایت
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger-soft">
            <LogoutIcon size={18} /> خروج از حساب
          </button>
        </form>
      </div>
    </div>
  );
}

/** پوسته داشبورد: Sidebar ثابت در دسکتاپ، منوی کشویی در موبایل */
export function DashboardShell({ sections, user, children }: { sections: ShellSection[]; user: ShellUser; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-border bg-surface p-5 lg:flex">
        <Logo className="mb-6 shrink-0" />
        <div className="min-h-0 flex-1">
          <SidebarContent sections={sections} user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <span className="flex items-center gap-1">
          <BellLink unread={user.unread} />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="باز کردن منو"
            aria-expanded={open}
            className="flex size-10 items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <MenuIcon />
          </button>
        </span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="منوی داشبورد">
          <button type="button" aria-label="بستن منو" className="absolute inset-0 bg-primary-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-[82%] max-w-xs overflow-y-auto bg-surface p-5 shadow-lift">
            <div className="mb-5 flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن منو" className="flex size-9 items-center justify-center rounded-md hover:bg-surface-muted">
                <XIcon />
              </button>
            </div>
            <SidebarContent sections={sections} user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
