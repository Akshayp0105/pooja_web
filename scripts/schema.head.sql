-- ═══════════════════════════════════════════════════════════════════
--  Pooja Veppu · പൂജവെയ്പ്  —  database schema (v2)
--  Supabase Dashboard → SQL Editor → paste this whole file → Run.
--  Safe to re-run. Replaces the v1 "offerings" setup.
--
--  Tables
--    profiles           one row per signed-in user (name, phone, email)
--    app_admins         emails allowed into the admin page
--    plans              ₹10 Samarppanam · ₹20 Prasadam · ₹30 Anugraham
--    submissions        a person's sealed belongings, one per submission
--    submission_files   the files inside each submission
--    payments           razorpay.me payment IDs awaiting admin approval
--    blessings          the 52 verses; each submission is assigned one
--    return_gifts       Prasadam: Saraswati photo, slokam card, song
--    daily_messages     ₹30 plan: one good-morning + slokam per day
--    notification_log   every daily email sent (one per user per day)
--
--  The browser never touches these tables directly: RLS is on with no
--  open policies, and everything goes through the functions below, which
--  check auth.uid(), the plan, the payment status and the unlock time.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── v1 cleanup ─────────────────────────────────────────────────────
drop policy if exists "pv: upload into a reserved offering" on storage.objects;
drop policy if exists "pv: read after vijayadashami" on storage.objects;
drop function if exists public.reserve_offering(text, text);
drop function if exists public.seal_offering(text, jsonb);
drop function if exists public.get_offering(text);
drop table if exists public.offerings;
drop sequence if exists public.offering_quote_seq;

-- ─── Core settings ──────────────────────────────────────────────────
-- Vijayadashami, Brahma Muhurtham (IST). Keep in sync with src/lib/config.ts.
create or replace function public.pv_unlock_at()
returns timestamptz language sql immutable as $$
  select timestamptz '2026-10-21 04:30:00+05:30'
$$;

create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values
  ('email_from', 'Pooja Veppu <onboarding@resend.dev>'),
  ('site_url',   'http://localhost:4173'),
  ('razorpay_link', 'https://razorpay.me/@akshayparambath')
on conflict (key) do nothing;

-- ─── Admins ─────────────────────────────────────────────────────────
create table if not exists public.app_admins (
  email text primary key
);
alter table public.app_admins enable row level security;
insert into public.app_admins (email) values ('akshay@samosainteractive.com')
on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from app_admins
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

-- ─── Profiles ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text check (char_length(full_name) <= 80),
  phone       text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.pv_handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists pv_on_auth_user_created on auth.users;
create trigger pv_on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.pv_handle_new_user();

-- Backfill anyone who signed up before this ran.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.pv_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists pv_profiles_touch on public.profiles;
create trigger pv_profiles_touch before update on public.profiles
  for each row execute function public.pv_touch_updated_at();

-- ─── Plans ──────────────────────────────────────────────────────────
create table if not exists public.plans (
  id              text primary key,
  name            text not null,
  name_ml         text not null,
  price_inr       integer not null check (price_inr > 0),
  summary         text not null,
  features        jsonb not null default '[]'::jsonb,
  includes_gift   boolean not null default false,
  includes_daily  boolean not null default false,
  sort            integer not null default 0,
  active          boolean not null default true
);
alter table public.plans enable row level security;
drop policy if exists "plans: public read" on public.plans;
create policy "plans: public read" on public.plans for select to anon, authenticated using (active);
grant select on public.plans to anon, authenticated;

insert into public.plans (id, name, name_ml, price_inr, summary, features, includes_gift, includes_daily, sort) values
  ('samarppanam', 'Samarppanam', 'സമർപ്പണം', 10,
   'Place your belongings on the peedham.',
   '["Submit books, notes, music, art, video or voice", "Sealed until Vijayadashami morning", "A blessing verse in Malayalam and English"]',
   false, false, 1),
  ('prasadam', 'Prasadam', 'പ്രസാദം', 20,
   'Samarppanam, with a return gift.',
   '["Everything in Samarppanam", "Return gift: a Saraswati photo", "Return gift: a Saraswati Vandana slokam card", "Return gift: a veena recital to keep"]',
   true, false, 2),
  ('anugraham', 'Anugraham', 'അനുഗ്രഹം', 30,
   'Prasadam, with a slokam every morning.',
   '["Everything in Prasadam", "A good-morning email every day of Navaratri", "Each with a slokam in Malayalam and English"]',
   true, true, 3)
on conflict (id) do update set
  name = excluded.name, name_ml = excluded.name_ml, price_inr = excluded.price_inr,
  summary = excluded.summary, features = excluded.features,
  includes_gift = excluded.includes_gift, includes_daily = excluded.includes_daily, sort = excluded.sort;

-- ─── Blessings ──────────────────────────────────────────────────────
create table if not exists public.blessings (
  id         integer primary key,
  en         text not null,
  ml         text not null,
  source     text not null,
  source_ml  text not null
);
alter table public.blessings enable row level security;

