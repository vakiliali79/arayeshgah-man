import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { uploadAvatarAction } from "@/features/dashboard/actions/customer";
import { StylistProfileForm } from "@/features/dashboard/components/profile-forms";
import { StylistOnboarding } from "@/features/dashboard/components/stylist-onboarding";
import { getStylistContext } from "@/server/dashboard/stylist-context";

export const metadata: Metadata = { title: "پروفایل حرفه‌ای" };

export default async function StylistProfilePage() {
  const { stylist } = await getStylistContext();
  if (!stylist) return <StylistOnboarding />;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-extrabold sm:text-2xl">پروفایل حرفه‌ای</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">اطلاعات نمایش‌داده‌شده به مشتریان</CardTitle></CardHeader>
        <CardContent>
          <StylistProfileForm stylist={{ displayName: stylist.displayName, slug: stylist.slug, specialties: stylist.specialties, yearsExperience: stylist.yearsExperience, city: stylist.city, district: stylist.district, bio: stylist.bio, acceptsIndependentBookings: stylist.acceptsIndependentBookings }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">تصویر پروفایل</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={uploadAvatarAction} submitLabel="بارگذاری تصویر" submitSize="sm">
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
