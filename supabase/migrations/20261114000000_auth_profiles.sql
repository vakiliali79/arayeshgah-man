-- ============================================================
-- ArayeshgahMan — مرحله ۱: نقش‌ها و پروفایل کاربران
-- (جداول سالن، آرایشگر، خدمات، رزرو، نظرات و نمونه‌کار در مرحله بعد)
-- ============================================================

create type public.user_role as enum ('customer', 'stylist', 'salon_owner', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) between 1 and 80),
  phone       text unique check (phone ~ '^09[0-9]{9}$'),
  avatar_url  text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.profiles.role is 'نقش معتبر کاربر؛ فقط توسط سیستم/ادمین قابل تغییر است';

-- ---------- updated_at خودکار ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- ساخت پروفایل هنگام ثبت‌نام ----------
-- نقش درخواستی از metadata فقط در صورت مجاز بودن پذیرفته می‌شود؛ admin هرگز.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'requested_role';
  safe_role public.user_role := 'customer';
begin
  if requested in ('customer', 'stylist', 'salon_owner') then
    safe_role := requested::public.user_role;
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    safe_role
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- تابع کمکی نقش برای RLS ----------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;

create policy "profiles: select own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin select all"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- جلوگیری از ارتقای سطح دسترسی: کاربر فقط ستون‌های مشخص را می‌تواند تغییر دهد (نه role)
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
revoke all on public.profiles from anon;
