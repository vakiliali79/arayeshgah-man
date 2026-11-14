# آرایشگاه من (ArayeshgahMan)

پلتفرم رزرو و مدیریت خدمات زیبایی — Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL)

## اجرا

```bash
npm install
cp .env.example .env.local   # مقادیر Supabase را وارد کنید
npm run dev                  # http://localhost:3000
```

صفحه اصلی بدون Supabase هم اجرا می‌شود؛ ورود و ثبت‌نام به تنظیم `.env.local` و اجرای مایگریشن نیاز دارند:

```bash
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push
```

در داشبورد Supabase، در Authentication → URL Configuration آدرس `http://localhost:3000/auth/callback` را به Redirect URLs اضافه کنید.

## اسکریپت‌ها

| دستور | کاربرد |
| --- | --- |
| `npm run dev` | سرور توسعه |
| `npm run build` / `npm start` | بیلد و اجرای production |
| `npm run lint` | ESLint |
| `npm run typecheck` | بررسی تایپ‌ها |

## ساختار پوشه‌ها

```
src/
  app/                 مسیرها (App Router)
    (marketing)/       صفحه اصلی و صفحات عمومی + هدر/فوتر
    (auth)/            ورود و ثبت‌نام
    auth/callback/     تأیید ایمیل (PKCE)
    dashboard/         داشبورد (محافظت‌شده)
  components/
    ui/                سیستم طراحی: Button, Input, Card, Badge, Alert, ...
    layout/            Header, Footer, MobileBottomNav
    icons/             آیکون‌های SVG
  features/            ماژول‌های دامنه (هر ماژول: components, actions, schemas)
    auth/
    home/
  lib/
    supabase/          کلاینت مرورگر، سرور و proxy
    auth/              محافظ‌های سمت سرور (requireUser)
    utils/             cn، ارقام فارسی، قالب‌بندی مبلغ
  config/              نقش‌ها، مسیرها، اطلاعات سایت
  types/               تایپ‌های دیتابیس
  proxy.ts             تازه‌سازی نشست و محافظت مسیرها (جایگزین middleware در Next 16)
supabase/migrations/   مایگریشن‌های SQL
```
