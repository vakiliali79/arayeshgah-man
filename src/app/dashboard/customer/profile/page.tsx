import type { Metadata } from "next";
import Image from "next/image";
import { Avatar, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ROLE_META } from "@/config/roles";
import { uploadAvatarAction } from "@/features/dashboard/actions/customer";
import { CustomerProfileForm } from "@/features/dashboard/components/profile-forms";
import { fileUrl } from "@/lib/files";
import { requireSession } from "@/server/auth/current";
import { formatPhoneForDisplay } from "@/server/otp/phone";

export const metadata: Metadata = { title: "اطلاعات حساب" };

export default async function CustomerProfilePage() {
  const { profile, user } = await requireSession();
  const avatar = fileUrl(profile.avatarFileId);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold sm:text-2xl">اطلاعات حساب</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">حساب کاربری</CardTitle>
          <CardDescription>شماره موبایل ورود قابل تغییر نیست.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-muted">موبایل ورود</p><p dir="ltr" className="text-end font-medium">{user.phoneNumber ? formatPhoneForDisplay(user.phoneNumber) : "—"}</p></div>
          <div><p className="text-muted">نوع حساب</p><p className="font-medium">{ROLE_META[profile.role].label}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">تصویر پروفایل</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-5">
          {avatar ? (
            <Image src={avatar} alt="تصویر پروفایل" width={80} height={80} unoptimized className="size-20 rounded-full object-cover" />
          ) : (
            <Avatar name={profile.fullName ?? user.name} className="size-20 text-xl" />
          )}
          <ActionForm action={uploadAvatarAction} submitLabel="بارگذاری تصویر" submitSize="sm" className="flex-1">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
            <p className="text-xs text-muted">JPG، PNG یا WebP، حداکثر ۵ مگابایت.</p>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات شخصی</CardTitle></CardHeader>
        <CardContent>
          <CustomerProfileForm fullName={profile.fullName ?? ""} phone={profile.phone ?? ""} city={profile.city ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
