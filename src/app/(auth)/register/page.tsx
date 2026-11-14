import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/config/roles";
import { ROUTES } from "@/config/routes";
import { RegisterForm } from "@/features/auth";
import { getCurrentSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "ثبت‌نام" };

function parseRole(value: unknown): SelfAssignableRole | undefined {
  return SELF_ASSIGNABLE_ROLES.find((r) => r === value);
}

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { role } = await searchParams;
  if (await getCurrentSession()) redirect(ROUTES.dashboard);

  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">ساخت حساب کاربری</h1>
        <p className="text-sm text-muted">در کمتر از یک دقیقه به جمع کاربران آرایشگاه من بپیوندید.</p>
      </header>
      <RegisterForm defaultRole={parseRole(role)} />
    </>
  );
}
