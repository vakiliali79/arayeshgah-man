/**
 * داده‌های نمایشی صفحه اصلی.
 * در مرحله اتصال به دیتابیس، با کوئری‌های دیتابیس (Drizzle) جایگزین می‌شود.
 */
export const categories = [
  { key: "hair", title: "کوتاهی و حالت مو", count: 320, icon: "scissors" },
  { key: "color", title: "رنگ و لایت", count: 210, icon: "brush" },
  { key: "nail", title: "کاشت و طراحی ناخن", count: 185, icon: "hand" },
  { key: "skin", title: "پاکسازی پوست", count: 140, icon: "face" },
  { key: "makeup", title: "میکاپ و گریم", count: 165, icon: "sparkle" },
  { key: "brow", title: "ابرو و مژه", count: 120, icon: "eye" },
] as const;

export const featuredSalons = [
  { id: "1", name: "سالن زیبایی رز طلایی", area: "تهران، زعفرانیه", rating: 4.9, reviews: 412, tags: ["رنگ مو", "میکاپ عروس"], hue: "from-primary-300 to-gold-200" },
  { id: "2", name: "استودیو آرتمیس", area: "تهران، سعادت‌آباد", rating: 4.8, reviews: 286, tags: ["ناخن", "مژه"], hue: "from-gold-200 to-primary-200" },
  { id: "3", name: "خانه زیبایی مهرو", area: "تهران، پاسداران", rating: 4.8, reviews: 198, tags: ["پوست", "ابرو"], hue: "from-primary-200 to-primary-400" },
  { id: "4", name: "سالن آرایش ماهتاب", area: "کرج، گوهردشت", rating: 4.7, reviews: 154, tags: ["کراتین", "کوتاهی"], hue: "from-gold-300 to-gold-100" },
] as const;

export const topStylists = [
  { id: "1", name: "نگار احمدی", specialty: "متخصص رنگ و لایت", rating: 5.0, jobs: 980 },
  { id: "2", name: "سارا کریمی", specialty: "میکاپ آرتیست", rating: 4.9, jobs: 760 },
  { id: "3", name: "مریم رضایی", specialty: "طراح ناخن", rating: 4.9, jobs: 1240 },
  { id: "4", name: "الهام موسوی", specialty: "متخصص پوست", rating: 4.8, jobs: 530 },
] as const;
