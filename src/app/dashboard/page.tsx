import type { Metadata } from "next";
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Logo } from "@/components/ui";
import { ROLE_META } from "@/config/roles";
import { signOutAction } from "@/features/auth/actions";
import { requireSession } from "@/server/auth/current";

export const metadata: Metadata = { title: "داشبورد" };
export const dynamic = "force-dynamic";

/** داشبورد موقت — داشبوردهای اختصاصی هر نقش در مراحل بعد ساخته می‌شوند */
export default async function DashboardPage() {
  const { user, profile } = await requireSession();
  const name = profile.fullName ?? user.name ?? user.email;
  const role = profile.role;

  return (
    <div className="bg-luxe min-h-dvh">
      <header className="container-page flex h-16 items-center justify-between">
        <Logo />
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            خروج
          </Button>
        </form>
      </header>
      <main className="container-page py-10">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar name={name} />
            <div className="space-y-1">
              <CardTitle>سلام، {name}</CardTitle>
              <Badge tone="gold">{ROLE_META[role].label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="leading-7">
              ورود شما با موفقیت انجام شد. داشبورد اختصاصی «{ROLE_META[role].label}» در مرحله بعدی توسعه آماده می‌شود.
            </CardDescription>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
