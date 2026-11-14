# آرایشگاه من (ArayeshgahMan)

پلتفرم رزرو و مدیریت خدمات زیبایی — Next.js 16 · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Better Auth

- معماری دیتابیس، مایگریشن، seed: [docs/database.md](docs/database.md)
- احراز هویت و امنیت: [docs/auth.md](docs/auth.md)

## اجرای محلی

```bash
npm install
cp .env.example .env.local          # DATABASE_URL و BETTER_AUTH_SECRET را تنظیم کنید (npx auth secret)
npm run db:migrate                  # ساخت جداول
npm run db:seed                     # داده نمونه (رمز همه کاربران: Password123)
npm run dev                         # http://localhost:3000
```

ساخت دیتابیس PostgreSQL محلی و جزئیات بیشتر در [docs/database.md](docs/database.md).
در توسعه، ایمیل‌های تأیید و بازیابی رمز به‌صورت فایل در `.data/mail/` ذخیره می‌شوند.

## اسکریپت‌ها

| دستور | کاربرد |
| --- | --- |
| `npm run dev` | سرور توسعه |
| `npm run build` / `npm start` | بیلد و اجرای production |
| `npm run lint` / `npm run typecheck` | ESLint و بررسی تایپ |
| `npm run db:migrate` / `npm run db:seed` | مایگریشن و داده نمونه |
| `npm test` | تست‌های واحد و یکپارچه با PostgreSQL (`.env.test.local` → `DATABASE_URL_TEST`) |
| `npm run test:e2e` | تست end-to-end احراز هویت با مرورگر (پس از `npm run build`) |
| `npm run db:create-admin -- <email>` | ارتقای کاربر به ادمین (تنها راه ساخت ادمین) |

## ساختار پوشه‌ها

```
src/
  app/                 مسیرها (App Router)
    (marketing)/       صفحه اصلی
    (auth)/            ورود، ثبت‌نام، فراموشی/بازیابی رمز، تأیید ایمیل
    api/auth/[...all]/ endpointهای Better Auth
    dashboard/         داشبورد (محافظت‌شده)
  components/          سیستم طراحی (ui)، layout، icons
  features/            ماژول‌های UI دامنه: auth، home
  db/                  اسکیمای Drizzle، اتصال و تایپ‌ها
  server/              سرویس‌های سمت سرور: auth، bookings، salons، storage، mail، …
  lib/                 utils و کلاینت Better Auth
  config/              نقش‌ها، مسیرها، اطلاعات سایت
  proxy.ts             هدایت مهمان‌ها از مسیرهای محافظت‌شده
drizzle/               مایگریشن‌های PostgreSQL
scripts/               migrate، seed، create-admin
tests/                 Vitest (واحد/یکپارچه) و tests/e2e (Playwright)
docs/                  مستندات
```
