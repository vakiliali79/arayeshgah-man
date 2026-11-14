import Link from "next/link";
import { buttonVariants } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="bg-luxe flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-gradient-gold text-7xl font-black">۴۰۴</p>
      <h1 className="text-xl font-bold">صفحه مورد نظر پیدا نشد</h1>
      <Link href="/" className={buttonVariants()}>
        بازگشت به صفحه اصلی
      </Link>
    </main>
  );
}
