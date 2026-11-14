export const siteConfig = {
  name: "آرایشگاه من",
  latinName: "ArayeshgahMan",
  description:
    "پلتفرم هوشمند رزرو آنلاین و مدیریت خدمات زیبایی؛ بهترین سالن‌ها و آرایشگران شهر، فقط با چند لمس.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "fa_IR",
} as const;
