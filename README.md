# آرایشگاه من (ArayeshgahMan)

پلتفرم رزرو و مدیریت خدمات زیبایی — Next.js 16 · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Better Auth

- معماری دیتابیس، مایگریشن، seed: [docs/database.md](docs/database.md)
- احراز هویت و امنیت: [docs/auth.md](docs/auth.md)
- داشبوردها، صفحات عمومی، جستجو و رزرو (مسیرها، نقش‌ها، راهنمای تست دستی): [docs/marketplace.md](docs/marketplace.md)

## اجرای محلی

```bash
npm install
cp .env.example .env.local          # DATABASE_URL و BETTER_AUTH_SECRET را تنظیم کنید (npx auth secret)
                                    # ورود/ثبت‌نام: شماره موبایل + کد آزمایشی 1111 (AUTH_OTP_MODE=static)
npm run db:migrate                  # ساخت جداول
npm run db:seed                     # داده نمونه (فقط دیتابیس محلی؛ ورود با شماره‌های نمونه و کد 1111)
npm run dev                         # http://localhost:3000
```

ساخت دیتابیس PostgreSQL محلی و جزئیات بیشتر در [docs/database.md](docs/database.md).
در توسعه هیچ پیامکی ارسال نمی‌شود؛ کد تأیید ثابت `1111` است (فقط محیط توسعه/تست).
حالت تست موقت `AUTH_TEST_MODE=true` (احراز هویت واقعی نیست): ورود هر شماره با `1111` و نقش admin برای `09991797982` — جزئیات در [docs/auth.md](docs/auth.md).

## اسکریپت‌ها

| دستور | کاربرد |
| --- | --- |
| `npm run dev` | سرور توسعه |
| `npm run build` / `npm start` | بیلد و اجرای production |
| `npm run lint` / `npm run typecheck` | ESLint و بررسی تایپ |
| `npm run db:migrate` / `npm run db:seed` | مایگریشن و داده نمونه |
| `npm test` | تست‌های واحد و یکپارچه با PostgreSQL (`.env.test.local` → `DATABASE_URL_TEST`) |
| `npm run test:e2e` | تست end-to-end با مرورگر: احراز هویت، رزرو کامل، دسترسی نقش‌ها، لینک‌های شکسته (پس از `npm run build`) |
| `npm run db:create-admin -- <موبایل>` | ارتقای کاربر به ادمین (تنها راه ساخت ادمین) |

## ساختار پوشه‌ها

```
src/
  app/                 مسیرها (App Router)
    (marketing)/       صفحه اصلی، صفحات محتوایی، جستجو و جزئیات سالن/آرایشگر، رزرو (/book)
    (auth)/            ورود و ثبت‌نام با موبایل + OTP
    api/auth/[...all]/ endpointهای Better Auth
    dashboard/         داشبورد نقش‌ها: customer، stylist، salon، admin (محافظت‌شده سمت سرور)
    api/files/[id]/    نمایش تصاویر عمومی
  components/          سیستم طراحی (ui)، layout، icons
  features/            ماژول‌های UI دامنه: auth، home، dashboard، public
  db/                  اسکیمای Drizzle، اتصال و تایپ‌ها
  server/              سرویس‌های سمت سرور: auth، otp، bookings، salons، storage، …
  lib/                 utils و کلاینت Better Auth
  config/              نقش‌ها، مسیرها، اطلاعات سایت
  proxy.ts             هدایت مهمان‌ها از مسیرهای محافظت‌شده
drizzle/               مایگریشن‌های PostgreSQL
scripts/               migrate، seed، create-admin
tests/                 Vitest (واحد/یکپارچه) و tests/e2e (Playwright)
docs/                  مستندات
```
