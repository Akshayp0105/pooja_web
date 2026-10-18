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

-- Admin = signed in with an address on the list that Supabase has confirmed
-- the user owns (so an unconfirmed sign-up with an admin's email gets nothing).
create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, auth as $$
  select exists (
    select 1 from app_admins a
      join auth.users u on lower(u.email) = lower(a.email)
     where u.id = auth.uid()
       and u.email_confirmed_at is not null
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

insert into public.blessings (id, en, ml, source, source_ml) values
  (1, 'In this world there is nothing as purifying as knowledge.', 'ഈ ലോകത്ത് ജ്ഞാനത്തോളം പവിത്രമായ മറ്റൊന്നുമില്ല.', 'Bhagavad Gita 4.38', 'ഭഗവദ്ഗീത 4.38'),
  (2, 'You have a right to your actions alone, never to their fruits.', 'കർമ്മം ചെയ്യുവാൻ മാത്രമേ നിനക്ക് അധികാരമുള്ളൂ; അതിന്റെ ഫലത്തിൽ ഒരിക്കലുമില്ല.', 'Bhagavad Gita 2.47', 'ഭഗവദ്ഗീത 2.47'),
  (3, 'Lead me from the unreal to the real, from darkness to light, from death to immortality.', 'അസത്യത്തിൽ നിന്ന് സത്യത്തിലേക്കും, ഇരുട്ടിൽ നിന്ന് വെളിച്ചത്തിലേക്കും, മരണത്തിൽ നിന്ന് അമരത്വത്തിലേക്കും എന്നെ നയിക്കേണമേ.', 'Brihadaranyaka Upanishad 1.3.28', 'ബൃഹദാരണ്യകോപനിഷത്ത് 1.3.28'),
  (4, 'Let noble thoughts come to us from every side.', 'എല്ലാ ദിക്കുകളിൽ നിന്നും ശ്രേഷ്ഠമായ ചിന്തകൾ നമ്മിലേക്ക് വന്നുചേരട്ടെ.', 'Rigveda 1.89.1', 'ഋഗ്വേദം 1.89.1'),
  (5, 'Arise, awake, and learn by approaching the wise.', 'ഉണരുക, എഴുന്നേൽക്കുക; ശ്രേഷ്ഠരായ ഗുരുക്കന്മാരെ സമീപിച്ച് അറിവ് നേടുക.', 'Katha Upanishad 1.3.14', 'കഠോപനിഷത്ത് 1.3.14'),
  (6, 'Truth alone triumphs, not falsehood.', 'സത്യം മാത്രമേ ജയിക്കൂ; അസത്യമല്ല.', 'Mundaka Upanishad 3.1.6', 'മുണ്ഡകോപനിഷത്ത് 3.1.6'),
  (7, 'Lift yourself by your own self; do not let yourself fall. The mind alone is your friend, and the mind alone your foe.', 'സ്വയം തന്നെ സ്വയം ഉയർത്തുക; സ്വയം താഴ്ത്താതിരിക്കുക. മനസ്സ് തന്നെയാണ് ഒരുവന്റെ ബന്ധുവും ശത്രുവും.', 'Bhagavad Gita 6.5', 'ഭഗവദ്ഗീത 6.5'),
  (8, 'Yoga is skill in action.', 'കർമ്മത്തിലെ കുശലതയാണ് യോഗം.', 'Bhagavad Gita 2.50', 'ഭഗവദ്ഗീത 2.50'),
  (9, 'One who has faith, devotion and mastery over the senses attains knowledge.', 'ശ്രദ്ധയും ആത്മസമർപ്പണവും ഇന്ദ്രിയനിയന്ത്രണവും ഉള്ളവൻ ജ്ഞാനം നേടുന്നു.', 'Bhagavad Gita 4.39', 'ഭഗവദ്ഗീത 4.39'),
  (10, 'Whenever righteousness declines and unrighteousness rises, I manifest Myself.', 'എപ്പോഴെല്ലാം ധർമ്മത്തിന് ക്ഷയവും അധർമ്മത്തിന് വളർച്ചയും ഉണ്ടാകുന്നുവോ, അപ്പോഴെല്ലാം ഞാൻ അവതരിക്കുന്നു.', 'Bhagavad Gita 4.7', 'ഭഗവദ്ഗീത 4.7'),
  (11, 'To the Devi who dwells in all beings as intelligence, salutations to Her, salutations to Her, salutations again and again.', 'എല്ലാ ജീവജാലങ്ങളിലും ബുദ്ധിരൂപത്തിൽ കുടികൊള്ളുന്ന ദേവിക്ക് നമസ്കാരം, നമസ്കാരം, വീണ്ടും വീണ്ടും നമസ്കാരം.', 'Devi Mahatmyam 5', 'ദേവീമാഹാത്മ്യം 5'),
  (12, 'To the Devi who dwells in all beings as strength, salutations to Her again and again.', 'എല്ലാ ജീവജാലങ്ങളിലും ശക്തിരൂപത്തിൽ കുടികൊള്ളുന്ന ദേവിക്ക് വീണ്ടും വീണ്ടും നമസ്കാരം.', 'Devi Mahatmyam 5', 'ദേവീമാഹാത്മ്യം 5'),
  (13, 'To the Devi who dwells in all beings as peace, salutations to Her again and again.', 'എല്ലാ ജീവജാലങ്ങളിലും ശാന്തിരൂപത്തിൽ കുടികൊള്ളുന്ന ദേവിക്ക് വീണ്ടും വീണ്ടും നമസ്കാരം.', 'Devi Mahatmyam 5', 'ദേവീമാഹാത്മ്യം 5'),
  (14, 'Speak the truth. Walk in dharma. Never neglect your study.', 'സത്യം പറയുക. ധർമ്മം ആചരിക്കുക. സ്വാധ്യായത്തിൽ ഒരിക്കലും അലസത കാട്ടരുത്.', 'Taittiriya Upanishad 1.11', 'തൈത്തിരീയോപനിഷത്ത് 1.11'),
  (15, 'Let your mother be as God to you; let your father be as God; let your teacher be as God.', 'അമ്മയെ ദൈവമായി കാണുക; അച്ഛനെ ദൈവമായി കാണുക; ഗുരുവിനെ ദൈവമായി കാണുക.', 'Taittiriya Upanishad 1.11', 'തൈത്തിരീയോപനിഷത്ത് 1.11'),
  (16, 'Find joy through letting go; covet no one’s wealth.', 'ത്യാഗത്തിലൂടെ ആനന്ദം അനുഭവിക്കുക; ആരുടെയും ധനം മോഹിക്കാതിരിക്കുക.', 'Isha Upanishad 1', 'ഈശാവാസ്യോപനിഷത്ത് 1'),
  (17, 'Thou art That.', 'അത് നീ ആകുന്നു.', 'Chandogya Upanishad 6.8.7', 'ഛാന്ദോഗ്യോപനിഷത്ത് 6.8.7'),
  (18, 'Brahman is truth, knowledge and the infinite.', 'സത്യവും ജ്ഞാനവും അനന്തവുമാണ് ബ്രഹ്മം.', 'Taittiriya Upanishad 2.1', 'തൈത്തിരീയോപനിഷത്ത് 2.1'),
  (19, 'May we be protected together; may we grow strong together; may our learning be radiant; may we never resent one another.', 'നാം ഒരുമിച്ച് സംരക്ഷിക്കപ്പെടട്ടെ; ഒരുമിച്ച് ശക്തരാകട്ടെ; നമ്മുടെ പഠനം തേജസ്സുറ്റതാകട്ടെ; നാം പരസ്പരം വിദ്വേഷിക്കാതിരിക്കട്ടെ.', 'Shanti Mantra, Katha Upanishad', 'ശാന്തിമന്ത്രം, കഠോപനിഷത്ത്'),
  (20, 'Knowledge gives humility; from humility comes worthiness.', 'വിദ്യ വിനയം നൽകുന്നു; വിനയത്തിൽ നിന്ന് യോഗ്യത ഉണ്ടാകുന്നു.', 'Hitopadesha', 'ഹിതോപദേശം'),
  (21, 'No thief can steal it, no king can seize it, no brother can divide it, and it grows the more it is shared. Knowledge is the greatest wealth.', 'കള്ളന് മോഷ്ടിക്കാനോ രാജാവിന് പിടിച്ചെടുക്കാനോ സഹോദരർക്ക് പങ്കിടാനോ കഴിയില്ല; പങ്കുവെക്കുംതോറും വളരുന്നു. വിദ്യാധനമാണ് എല്ലാ ധനത്തിലും ശ്രേഷ്ഠം.', 'Subhashitam', 'സുഭാഷിതം'),
  (22, 'May Saraswati, the purifier, rich in wisdom, bless our endeavours.', 'പവിത്രയും ജ്ഞാനസമ്പന്നയുമായ സരസ്വതി നമ്മുടെ ഉദ്യമങ്ങളെ അനുഗ്രഹിക്കട്ടെ.', 'Rigveda 1.3.10', 'ഋഗ്വേദം 1.3.10'),
  (23, 'Like a mighty river, Saraswati awakens every mind with her light and shines through all thought.', 'മഹാനദിയെപ്പോലെ സരസ്വതി തന്റെ പ്രകാശത്താൽ എല്ലാ മനസ്സുകളെയും ഉണർത്തി ശോഭിപ്പിക്കുന്നു.', 'Rigveda 1.3.12', 'ഋഗ്വേദം 1.3.12'),
  (24, 'Pleasure and pain, heat and cold come and go; they are not lasting. Bear them patiently.', 'സുഖദുഃഖങ്ങളും ശീതോഷ്ണങ്ങളും വന്നുപോകുന്നവയാണ്, നിത്യമല്ല; അവയെ ക്ഷമയോടെ സഹിക്കുക.', 'Bhagavad Gita 2.14', 'ഭഗവദ്ഗീത 2.14'),
  (25, 'The mind is restless, yet it is mastered by steady practice and detachment.', 'മനസ്സ് ചഞ്ചലമാണ്; എങ്കിലും അഭ്യാസം കൊണ്ടും വൈരാഗ്യം കൊണ്ടും അതിനെ കീഴടക്കാം.', 'Bhagavad Gita 6.35', 'ഭഗവദ്ഗീത 6.35'),
  (26, 'A leaf, a flower, a fruit or a little water: whatever is offered to Me with love, I accept.', 'ഇലയോ പൂവോ പഴമോ ജലമോ: സ്നേഹത്തോടെ എനിക്ക് സമർപ്പിക്കുന്നതെന്തും ഞാൻ സ്വീകരിക്കുന്നു.', 'Bhagavad Gita 9.26', 'ഭഗവദ്ഗീത 9.26'),
  (27, 'Wherever there is Krishna, lord of yoga, and Arjuna, the archer, there will surely be fortune, victory, prosperity and righteousness.', 'യോഗേശ്വരനായ കൃഷ്ണനും ധനുർധാരിയായ അർജ്ജുനനും എവിടെയുണ്ടോ, അവിടെ ഐശ്വര്യവും വിജയവും അഭിവൃദ്ധിയും ഉറച്ച നീതിയും ഉണ്ടാകും.', 'Bhagavad Gita 18.78', 'ഭഗവദ്ഗീത 18.78'),
  (28, 'Learn it through humble reverence, sincere questions and service; the wise who have seen the truth will teach you.', 'വിനയത്തോടെ നമസ്കരിച്ചും ചോദിച്ചും സേവിച്ചും അറിവ് നേടുക; സത്യം കണ്ട ജ്ഞാനികൾ നിനക്ക് ഉപദേശിക്കും.', 'Bhagavad Gita 4.34', 'ഭഗവദ്ഗീത 4.34'),
  (29, 'No effort on this path is ever lost, and even a little of it shields you from great fear.', 'ഈ മാർഗ്ഗത്തിലെ ഒരു പരിശ്രമവും പാഴാകുന്നില്ല; അതിന്റെ അൽപം പോലും വലിയ ഭയത്തിൽ നിന്ന് രക്ഷിക്കുന്നു.', 'Bhagavad Gita 2.40', 'ഭഗവദ്ഗീത 2.40'),
  (30, 'One who does good never comes to an evil end.', 'നന്മ ചെയ്യുന്ന ഒരുവനും ഒരിക്കലും ദുർഗതി വരുന്നില്ല.', 'Bhagavad Gita 6.40', 'ഭഗവദ്ഗീത 6.40'),
  (31, 'Whatever the great do, others follow; the standard they set, the world pursues.', 'ശ്രേഷ്ഠർ എന്ത് ആചരിക്കുന്നുവോ, അതുതന്നെ മറ്റുള്ളവരും പിന്തുടരുന്നു; അവർ കാണിക്കുന്ന മാതൃക ലോകം സ്വീകരിക്കുന്നു.', 'Bhagavad Gita 3.21', 'ഭഗവദ്ഗീത 3.21'),
  (32, 'Dharma protects those who protect it.', 'ധർമ്മത്തെ സംരക്ഷിക്കുന്നവരെ ധർമ്മം സംരക്ഷിക്കുന്നു.', 'Manusmriti 8.15', 'മനുസ്മൃതി 8.15'),
  (33, 'Non-violence is the highest dharma.', 'അഹിംസയാണ് പരമമായ ധർമ്മം.', 'Mahabharata, Anushasana Parva', 'മഹാഭാരതം, അനുശാസനപർവ്വം'),
  (34, 'Mother and motherland are greater even than heaven.', 'അമ്മയും ജന്മഭൂമിയും സ്വർഗ്ഗത്തേക്കാൾ മഹത്തരമാണ്.', 'Ramayana (traditional)', 'രാമായണം (പരമ്പരാഗതം)'),
  (35, 'Enthusiasm is mighty; there is no power greater than enthusiasm. For the enthusiastic, nothing in the world is out of reach.', 'ഉത്സാഹം ബലവത്താണ്; ഉത്സാഹത്തേക്കാൾ വലിയ ശക്തിയില്ല. ഉത്സാഹമുള്ളവന് ലോകത്ത് അപ്രാപ്യമായി ഒന്നുമില്ല.', 'Valmiki Ramayana, Kishkindha Kanda', 'വാല്മീകി രാമായണം, കിഷ്കിന്ധാകാണ്ഡം'),
  (36, 'Salutations to Lord Ganesha. May your every beginning be free of obstacles.', 'ഹരിഃ ശ്രീ ഗണപതയേ നമഃ. അവിഘ്നമസ്തു: നിന്റെ ഓരോ തുടക്കവും തടസ്സങ്ങളില്ലാത്തതാകട്ടെ.', 'Vidyarambham Mantra', 'വിദ്യാരംഭമന്ത്രം'),
  (37, 'Salutations to Saraswati, giver of boons. As I begin my learning, may success be mine always.', 'വരദായിനിയായ സരസ്വതീ, നിനക്ക് നമസ്കാരം. ഞാൻ വിദ്യ ആരംഭിക്കുന്നു; എനിക്ക് എന്നും സിദ്ധിയുണ്ടാകട്ടെ.', 'Saraswati Dhyana Shloka', 'സരസ്വതീ ധ്യാനശ്ലോകം'),
  (38, 'Two kinds of knowledge are to be known: the higher and the lower.', 'അറിയേണ്ടത് രണ്ടു വിദ്യകളാണ്: പരാവിദ്യയും അപരാവിദ്യയും.', 'Mundaka Upanishad 1.1.4', 'മുണ്ഡകോപനിഷത്ത് 1.1.4'),
  (39, 'That which the mind cannot think, but by which the mind thinks: know that alone to be Brahman.', 'മനസ്സുകൊണ്ട് ചിന്തിക്കാനാവാത്തത്, എന്നാൽ മനസ്സിനെ ചിന്തിപ്പിക്കുന്നത്: അതുതന്നെയാണ് ബ്രഹ്മമെന്ന് അറിയുക.', 'Kena Upanishad 1.6', 'കേനോപനിഷത്ത് 1.6'),
  (40, 'O auspiciousness of all that is auspicious, giver of every good, our refuge: Narayani, salutations to You.', 'സർവ്വമംഗളങ്ങളുടെയും മംഗളമായവളേ, എല്ലാ നന്മകളും നൽകുന്നവളേ, ശരണ്യേ: നാരായണീ, നിനക്ക് നമസ്കാരം.', 'Devi Mahatmyam 11.10', 'ദേവീമാഹാത്മ്യം 11.10'),
  (41, 'Abandon every other refuge and take refuge in Me alone. I shall free you from all sorrow; do not grieve.', 'മറ്റെല്ലാ ആശ്രയങ്ങളും ഉപേക്ഷിച്ച് എന്നെ മാത്രം ശരണം പ്രാപിക്കുക. ഞാൻ നിന്നെ എല്ലാ ദുഃഖങ്ങളിൽ നിന്നും മോചിപ്പിക്കും; ദുഃഖിക്കേണ്ട.', 'Bhagavad Gita 18.66', 'ഭഗവദ്ഗീത 18.66'),
  (42, 'The Self is never born and never dies. Unborn, eternal, it is not slain when the body is slain.', 'ആത്മാവ് ഒരിക്കലും ജനിക്കുന്നില്ല, മരിക്കുന്നില്ല. ജന്മമില്ലാത്ത, നിത്യമായ അത് ശരീരം നശിക്കുമ്പോൾ നശിക്കുന്നില്ല.', 'Bhagavad Gita 2.20', 'ഭഗവദ്ഗീത 2.20'),
  (43, 'Among all knowledge, I am the knowledge of the Self.', 'വിദ്യകളിൽ ഞാൻ അധ്യാത്മവിദ്യയാകുന്നു.', 'Bhagavad Gita 10.32', 'ഭഗവദ്ഗീത 10.32'),
  (44, 'From anger comes delusion; from delusion, lost memory; from lost memory, the ruin of reason. Guard your calm.', 'ക്രോധത്തിൽ നിന്ന് മോഹം, മോഹത്തിൽ നിന്ന് സ്മൃതിഭ്രംശം, സ്മൃതിഭ്രംശത്തിൽ നിന്ന് ബുദ്ധിനാശം. ശാന്തത കാത്തുസൂക്ഷിക്കുക.', 'Bhagavad Gita 2.63', 'ഭഗവദ്ഗീത 2.63'),
  (45, 'Let your purpose be one, your hearts in harmony, your minds united, so that you may live well together.', 'നിങ്ങളുടെ ലക്ഷ്യം ഒന്നായിരിക്കട്ടെ, ഹൃദയങ്ങൾ ഐക്യത്തിലാകട്ടെ, മനസ്സുകൾ ഒരുമിക്കട്ടെ; അങ്ങനെ നിങ്ങൾ ഒത്തൊരുമിച്ച് ജീവിക്കട്ടെ.', 'Rigveda 10.191.4', 'ഋഗ്വേദം 10.191.4'),
  (46, 'The whole world is one family.', 'ലോകം മുഴുവൻ ഒരു കുടുംബമാണ്.', 'Maha Upanishad 6.71', 'മഹോപനിഷത്ത് 6.71'),
  (47, 'Words that cause no distress, that are true, kind and helpful, and the daily practice of study: this is the austerity of speech.', 'ആരെയും വേദനിപ്പിക്കാത്തതും സത്യവും പ്രിയവും ഹിതവുമായ വാക്കും, നിത്യമായ സ്വാധ്യായവും: ഇതാണ് വാക്കിന്റെ തപസ്സ്.', 'Bhagavad Gita 17.15', 'ഭഗവദ്ഗീത 17.15'),
  (48, 'Better your own dharma, imperfectly done, than another’s dharma done well.', 'മറ്റൊരാളുടെ ധർമ്മം നന്നായി അനുഷ്ഠിക്കുന്നതിനേക്കാൾ ശ്രേഷ്ഠം, കുറവുകളോടെയെങ്കിലും സ്വധർമ്മം അനുഷ്ഠിക്കുന്നതാണ്.', 'Bhagavad Gita 3.35', 'ഭഗവദ്ഗീത 3.35'),
  (49, 'The wise see with an equal eye the learned scholar, the cow, the elephant, the dog and the outcast.', 'വിദ്യാവിനയസമ്പന്നനായ ബ്രാഹ്മണനിലും പശുവിലും ആനയിലും നായയിലും ചണ്ഡാലനിലും ജ്ഞാനികൾ സമദർശികളാണ്.', 'Bhagavad Gita 5.18', 'ഭഗവദ്ഗീത 5.18'),
  (50, 'Just as a lamp in a windless place does not flicker, so is the steady mind of one who is disciplined.', 'കാറ്റില്ലാത്ത സ്ഥലത്തെ ദീപം ഇളകാത്തതുപോലെയാണ് ആത്മസംയമിയുടെ സ്ഥിരമായ മനസ്സ്.', 'Bhagavad Gita 6.19', 'ഭഗവദ്ഗീത 6.19'),
  (51, 'As the blazing fire turns wood to ashes, so the fire of knowledge turns all karma to ashes.', 'ജ്വലിക്കുന്ന അഗ്നി വിറകിനെ ഭസ്മമാക്കുന്നതുപോലെ, ജ്ഞാനാഗ്നി എല്ലാ കർമ്മങ്ങളെയും ഭസ്മമാക്കുന്നു.', 'Bhagavad Gita 4.37', 'ഭഗവദ്ഗീത 4.37'),
  (52, 'May all beings be happy; may all be free from illness; may all see goodness; may no one suffer.', 'എല്ലാവരും സുഖമായിരിക്കട്ടെ; എല്ലാവരും രോഗമുക്തരാകട്ടെ; എല്ലാവരും നന്മ കാണട്ടെ; ആർക്കും ദുഃഖമുണ്ടാകാതിരിക്കട്ടെ.', 'Shanti Mantra', 'ശാന്തിമന്ത്രം')
on conflict (id) do update set en = excluded.en, ml = excluded.ml, source = excluded.source, source_ml = excluded.source_ml;

create sequence if not exists public.pv_blessing_seq minvalue 0 start 0;

-- Consecutive submissions get blessings 7 apart (7 is coprime with 52),
-- so the first 52 submissions all receive different verses.
create or replace function public.pv_next_blessing()
returns integer language plpgsql volatile
set search_path = public as $$
declare
  total integer := (select count(*) from blessings);
begin
  if total = 0 then return null; end if;
  return ((nextval('public.pv_blessing_seq') * 7) % total) + 1;
end $$;

-- ─── Submissions ────────────────────────────────────────────────────
do $$ begin
  create type public.submission_status as enum
    ('draft', 'awaiting_payment', 'payment_review', 'confirmed', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  user_id       uuid not null references auth.users on delete cascade,
  plan_id       text not null references public.plans,
  devotee_name  text check (char_length(devotee_name) <= 80),
  note          text check (char_length(note) <= 4000),
  blessing_id   integer references public.blessings,
  status        public.submission_status not null default 'draft',
  created_at    timestamptz not null default now(),
  sealed_at     timestamptz,
  confirmed_at  timestamptz
);
create index if not exists submissions_user_idx on public.submissions (user_id, created_at desc);
create index if not exists submissions_status_idx on public.submissions (status);
alter table public.submissions enable row level security;

create table if not exists public.submission_files (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.submissions on delete cascade,
  path           text not null unique,
  name           text not null,
  size_bytes     bigint not null check (size_bytes >= 0),
  mime           text not null,
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists submission_files_sub_idx on public.submission_files (submission_id, position);
alter table public.submission_files enable row level security;

-- ─── Payments ───────────────────────────────────────────────────────
create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  submission_id        uuid not null references public.submissions on delete cascade,
  user_id              uuid not null references auth.users on delete cascade,
  plan_id              text not null references public.plans,
  amount_inr           integer not null,
  razorpay_payment_id  text not null unique check (razorpay_payment_id ~ '^pay_[A-Za-z0-9]{14}$'),
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note           text,
  reviewed_by          text,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists payments_status_idx on public.payments (status, created_at);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_submission_idx on public.payments (submission_id, created_at desc);
alter table public.payments enable row level security;

-- ─── Return gifts (Prasadam) ────────────────────────────────────────
create table if not exists public.return_gifts (
  id            text primary key,
  kind          text not null check (kind in ('photo', 'slokam', 'song')),
  title         text not null,
  title_ml      text not null,
  description   text not null,
  storage_path  text not null,
  sort          integer not null default 0
);
alter table public.return_gifts enable row level security;
insert into public.return_gifts (id, kind, title, title_ml, description, storage_path, sort) values
  ('photo',  'photo',  'Saraswati Devi', 'സരസ്വതീ ദേവി', 'A photo of the Goddess for your study table or phone wallpaper.', 'saraswati.png', 1),
  ('slokam', 'slokam', 'Saraswati Vandana card', 'സരസ്വതീ വന്ദനം', 'The complete Saraswati Vandana in Malayalam, as a card to keep.', 'saraswati-vandana.png', 2),
  ('song',   'song',   'Veena recital', 'വീണാവാദനം', 'Sree Neelotpala Nayike on the veena by L. Ramakrishnan (CC0).', 'veena.mp3', 3)
on conflict (id) do update set
  kind = excluded.kind, title = excluded.title, title_ml = excluded.title_ml,
  description = excluded.description, storage_path = excluded.storage_path, sort = excluded.sort;

-- ─── Daily messages (Anugraham) ─────────────────────────────────────
create table if not exists public.daily_messages (
  day           date primary key,
  subject       text not null,
  greeting_en   text not null,
  greeting_ml   text not null,
  slokam_ml     text not null,
  slokam_tr     text not null,
  slokam_en     text not null,
  source        text not null
);
alter table public.daily_messages enable row level security;
insert into public.daily_messages values
  ('2026-10-18', 'സുപ്രഭാതം · Durgashtami, Pooja Veppu today',
   'Good morning! Today is Durgashtami. This evening, books and instruments are laid before the Goddess.',
   'സുപ്രഭാതം! ഇന്ന് ദുർഗ്ഗാഷ്ടമി. സന്ധ്യയ്ക്ക് പുസ്തകങ്ങളും ഉപകരണങ്ങളും ദേവീസന്നിധിയിൽ പൂജയ്ക്ക് വെയ്ക്കുന്ന ദിവസം.',
   E'സർവ്വമംഗളമാംഗല്യേ ശിവേ സർവ്വാർത്ഥസാധികേ\nശരണ്യേ ത്ര്യംബകേ ഗൗരി നാരായണി നമോഽസ്തു തേ',
   E'Sarvamangala Maangalye Shive Sarvaartha Saadhike\nSharanye Tryambake Gauri Naaraayani Namostu Te',
   'O auspiciousness of all that is auspicious, giver of every good, our refuge, three-eyed Gauri: Narayani, salutations to You.',
   'Devi Mahatmyam 11.10'),
  ('2026-10-19', 'സുപ്രഭാതം · The books are resting',
   'Good morning! The books are resting before the Goddess. Today, let the mind be still and turn inward.',
   'സുപ്രഭാതം! പുസ്തകങ്ങൾ പൂജയിലാണ്. ഇന്ന് മനസ്സിനെ ശാന്തമാക്കി, ഉള്ളിലെ അറിവിനെ ധ്യാനിക്കാം.',
   E'കരാഗ്രേ വസതേ ലക്ഷ്മീ കരമധ്യേ സരസ്വതീ\nകരമൂലേ തു ഗോവിന്ദഃ പ്രഭാതേ കരദർശനം',
   E'Karaagre Vasate Lakshmee Karamadhye Saraswatee\nKaramoole Tu Govindah Prabhaate Karadarshanam',
   'At the tips of the fingers dwells Lakshmi, at the centre of the palm Saraswati, at its base Govinda. Look upon your palms at dawn.',
   'Morning prayer'),
  ('2026-10-20', 'സുപ്രഭാതം · Mahanavami, Adachupooja',
   'Good morning! Today is Mahanavami, the day of Adachupooja. The books stay closed; learn in silence.',
   'സുപ്രഭാതം! ഇന്ന് മഹാനവമി, അടച്ചുപൂജയുടെ ദിവസം. പുസ്തകങ്ങൾ തുറക്കാതെ, നിശ്ശബ്ദതയിലൂടെ ഉള്ളിലേക്ക് നോക്കാം.',
   E'യാ ദേവീ സർവ്വഭൂതേഷു വിദ്യാരൂപേണ സംസ്ഥിതാ\nനമസ്തസ്യൈ നമസ്തസ്യൈ നമസ്തസ്യൈ നമോ നമഃ',
   E'Yaa Devee Sarvabhooteshu Vidyaa Roopena Samsthitaa\nNamastasyai Namastasyai Namastasyai Namo Namah',
   'To the Goddess who dwells in every being as knowledge: salutations to Her, again and again.',
   'Devi Mahatmyam 5'),
  ('2026-10-21', 'വിജയദശമി ആശംസകൾ · Your belongings are ready',
   'Good morning, and a blessed Vijayadashami! Today is Pooja Eduppu and Vidyarambham. Read one page, play one note, and begin again.',
   'സുപ്രഭാതം! വിജയദശമി ആശംസകൾ. ഇന്ന് പൂജയെടുപ്പും വിദ്യാരംഭവും. ഒരു താളെങ്കിലും വായിച്ച് പുതിയ തുടക്കം കുറിക്കാം.',
   E'സരസ്വതി നമസ്തുഭ്യം വരദേ കാമരൂപിണി\nവിദ്യാരംഭം കരിഷ്യാമി സിദ്ധിർഭവതു മേ സദാ',
   E'Saraswati Namasthubhyam Varade Kaama Roopini\nVidyaarambham Karishyaami Siddhir Bhavathu Me Sadaa',
   'Salutations to Saraswati, giver of boons. As I begin my learning, may success be mine always.',
   'Saraswati Dhyana Shloka')
on conflict (day) do update set
  subject = excluded.subject, greeting_en = excluded.greeting_en, greeting_ml = excluded.greeting_ml,
  slokam_ml = excluded.slokam_ml, slokam_tr = excluded.slokam_tr, slokam_en = excluded.slokam_en,
  source = excluded.source;

create table if not exists public.notification_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users on delete cascade,
  day         date not null,
  channel     text not null default 'email',
  to_address  text not null,
  request_id  bigint,
  status      text not null default 'queued',
  created_at  timestamptz not null default now(),
  unique (user_id, day, channel)
);
alter table public.notification_log enable row level security;
create index if not exists notification_log_day_idx on public.notification_log (day);

-- ─── Rate limiting ──────────────────────────────────────────────────
-- A Redis-style fixed-window counter. UNLOGGED skips the write-ahead log, so
-- it is fast and cheap; its contents are disposable (a crash only resets the
-- counters).
create unlogged table if not exists public.rate_limits (
  key           text primary key,
  hits          integer not null,
  window_start  timestamptz not null
);
alter table public.rate_limits enable row level security;

create or replace function public.pv_rate_limit(p_key text, p_max integer, p_window interval)
returns void language plpgsql volatile security definer
set search_path = public as $$
declare
  n integer;
begin
  insert into rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    hits         = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into n;
  if n > p_max then
    raise exception 'RATE_LIMITED' using hint = 'Too many requests, slow down.';
  end if;
  -- Occasionally sweep old counters so the table stays tiny.
  if random() < 0.005 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
end $$;

-- ─── Helpers ────────────────────────────────────────────────────────
create or replace function public.pv_new_code()
returns text language plpgsql volatile
set search_path = public, extensions as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  b bytea := gen_random_bytes(12);
  result text := 'PV-';
begin
  for i in 0..11 loop
    result := result || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    if i in (3, 7) then result := result || '-'; end if;
  end loop;
  return result;
end $$;

create or replace function public.pv_require_user()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  return auth.uid();
end $$;

-- ─── User functions ─────────────────────────────────────────────────

-- 1. Start a submission (before uploading files).
create or replace function public.create_submission(p_plan text, p_name text, p_note text)
returns text language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  uid uuid := pv_require_user();
  c text;
begin
  perform pv_rate_limit('create:' || uid, 10, interval '1 hour');
  if now() >= pv_unlock_at() then raise exception 'SUBMISSIONS_CLOSED'; end if;
  if not exists (select 1 from plans where id = p_plan and active) then raise exception 'UNKNOWN_PLAN'; end if;
  if (select count(*) from submissions where user_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_SUBMISSIONS';
  end if;
  -- Stop one account from piling up unpaid uploads.
  if (select count(*) from submissions where user_id = uid and status in ('draft', 'awaiting_payment', 'rejected')) >= 5 then
    raise exception 'TOO_MANY_UNPAID';
  end if;
  loop
    c := pv_new_code();
    begin
      insert into submissions (code, user_id, plan_id, devotee_name, note, blessing_id)
      values (c, uid, p_plan,
              nullif(btrim(left(coalesce(p_name, ''), 80)), ''),
              nullif(btrim(left(coalesce(p_note, ''), 4000)), ''),
              pv_next_blessing());
      exit;
    exception when unique_violation then
    end;
  end loop;
  return c;
end $$;

-- 2. Seal it once the files are uploaded; it now waits for payment.
create or replace function public.seal_submission(p_code text, p_files jsonb)
returns boolean language plpgsql volatile security definer
set search_path = public as $$
declare
  s submissions;
  f jsonb;
  i integer := 0;
begin
  perform pv_rate_limit('seal:' || pv_require_user(), 20, interval '1 hour');
  select * into s from submissions
   where code = p_code and user_id = pv_require_user() and status = 'draft'
   for update;
  if not found or now() >= pv_unlock_at() then return false; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 20 then
    raise exception 'INVALID_FILES';
  end if;
  if jsonb_array_length(p_files) = 0 and s.note is null then raise exception 'EMPTY_SUBMISSION'; end if;
  if (select coalesce(sum((e ->> 'size')::bigint), 0) from jsonb_array_elements(p_files) e) > 500 * 1024 * 1024 then
    raise exception 'TOO_LARGE';
  end if;

  for f in select * from jsonb_array_elements(p_files) loop
    if left(f ->> 'path', length(s.code) + 1) <> s.code || '/' then raise exception 'INVALID_FILES'; end if;
    -- Only accept paths that really were uploaded into this submission's folder.
    if not exists (select 1 from storage.objects o where o.bucket_id = 'belongings' and o.name = f ->> 'path') then
      raise exception 'FILE_MISSING';
    end if;
    insert into submission_files (submission_id, path, name, size_bytes, mime, position)
    values (s.id, f ->> 'path', left(f ->> 'name', 200), (f ->> 'size')::bigint,
            coalesce(nullif(f ->> 'type', ''), 'application/octet-stream'), i);
    i := i + 1;
  end loop;

  update submissions set status = 'awaiting_payment', sealed_at = now() where id = s.id;
  return true;
end $$;

-- 3. Record the Razorpay payment ID for admin approval.
create or replace function public.submit_payment(p_code text, p_payment_id text)
returns boolean language plpgsql volatile security definer
set search_path = public as $$
declare
  s submissions;
  pid text := btrim(p_payment_id);
begin
  perform pv_rate_limit('pay:' || pv_require_user(), 10, interval '1 hour');
  select * into s from submissions
   where code = p_code and user_id = pv_require_user()
     and status in ('awaiting_payment', 'rejected')
   for update;
  if not found then return false; end if;
  if (select count(*) from payments where user_id = s.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'TOO_MANY_ATTEMPTS';
  end if;
  if (select count(*) from payments where submission_id = s.id and status = 'rejected') >= 3 then
    raise exception 'CONTACT_SUPPORT';
  end if;
  if pid !~ '^pay_[A-Za-z0-9]{14}$' then raise exception 'INVALID_PAYMENT_ID'; end if;
  if exists (select 1 from payments where razorpay_payment_id = pid) then raise exception 'PAYMENT_ID_USED'; end if;

  insert into payments (submission_id, user_id, plan_id, amount_inr, razorpay_payment_id)
  select s.id, s.user_id, s.plan_id, p.price_inr, pid from plans p where p.id = s.plan_id;
  update submissions set status = 'payment_review' where id = s.id;
  return true;
end $$;

-- 4. Everything the signed-in user has submitted.
create or replace function public.my_submissions()
returns jsonb language plpgsql volatile security definer
set search_path = public
set statement_timeout = '5s' as $$
begin
  perform pv_rate_limit('list:' || pv_require_user(), 60, interval '1 minute');
  return (
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) from (
    select s.code, s.status, s.created_at, s.devotee_name as name,
           jsonb_build_object('id', p.id, 'name', p.name, 'name_ml', p.name_ml, 'price_inr', p.price_inr,
                              'includes_gift', p.includes_gift, 'includes_daily', p.includes_daily) as plan,
           (select count(*) from submission_files f where f.submission_id = s.id) as file_count,
           s.note is not null as has_note,
           (select jsonb_build_object('status', pay.status, 'payment_id', pay.razorpay_payment_id, 'note', pay.admin_note)
              from payments pay where pay.submission_id = s.id order by pay.created_at desc limit 1) as payment,
           now() >= pv_unlock_at() as unlocked
      from submissions s join plans p on p.id = s.plan_id
     where s.user_id = auth.uid() and s.status <> 'draft'
     order by s.created_at desc
     limit 100
  ) r
  );
end $$;

-- 5. Open a submission on Vijayadashami (owner only, payment confirmed).
create or replace function public.open_submission(p_code text)
returns jsonb language plpgsql volatile security definer
set search_path = public
set statement_timeout = '5s' as $$
declare
  s submissions;
  p plans;
begin
  perform pv_rate_limit('open:' || pv_require_user(), 60, interval '1 minute');
  select * into s from submissions where code = upper(btrim(p_code)) and user_id = pv_require_user();
  if not found then return null; end if;
  select * into p from plans where id = s.plan_id;

  if now() < pv_unlock_at() or s.status <> 'confirmed' then
    return jsonb_build_object('unlocked', false, 'code', s.code, 'status', s.status, 'unlock_at', pv_unlock_at());
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'code', s.code,
    'name', s.devotee_name,
    'note', s.note,
    'created_at', s.created_at,
    'plan', jsonb_build_object('id', p.id, 'name', p.name, 'name_ml', p.name_ml),
    'files', coalesce((select jsonb_agg(jsonb_build_object('path', f.path, 'name', f.name, 'size', f.size_bytes, 'type', f.mime) order by f.position)
                         from submission_files f where f.submission_id = s.id), '[]'::jsonb),
    'blessing', (select jsonb_build_object('id', b.id, 'en', b.en, 'ml', b.ml, 'source', b.source, 'source_ml', b.source_ml,
                                           'total', (select count(*) from blessings))
                   from blessings b where b.id = s.blessing_id),
    'gifts', case when p.includes_gift then
               coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'kind', g.kind, 'title', g.title, 'title_ml', g.title_ml,
                                                             'description', g.description, 'path', g.storage_path) order by g.sort)
                           from return_gifts g), '[]'::jsonb)
             else '[]'::jsonb end
  );
end $$;

-- ─── Admin audit log ────────────────────────────────────────────────
create table if not exists public.admin_audit (
  id          bigserial primary key,
  admin_email text not null,
  action      text not null,
  payment_id  uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.admin_audit enable row level security;

-- ─── Admin functions ────────────────────────────────────────────────
create or replace function public.pv_require_admin()
returns void language plpgsql stable security definer
set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
end $$;

create or replace function public.admin_payments(p_status text default 'pending')
returns jsonb language plpgsql volatile security definer
set search_path = public
set statement_timeout = '8s' as $$
begin
  perform pv_require_admin();
  perform pv_rate_limit('admin:' || auth.uid(), 120, interval '1 minute');
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at) from (
      select pay.id, pay.razorpay_payment_id as payment_id, pay.amount_inr, pay.status, pay.admin_note,
             pay.created_at, pay.reviewed_at, pay.reviewed_by,
             s.code, s.devotee_name, pl.name as plan_name, pl.price_inr,
             pr.email, pr.full_name, pr.phone,
             (select count(*) from submission_files f where f.submission_id = s.id) as file_count
        from payments pay
        join submissions s on s.id = pay.submission_id
        join plans pl on pl.id = pay.plan_id
        left join profiles pr on pr.id = pay.user_id
       where p_status = 'all' or pay.status = p_status
       order by pay.created_at
       limit 500
    ) r), '[]'::jsonb);
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql volatile security definer
set search_path = public
set statement_timeout = '8s' as $$
begin
  perform pv_require_admin();
  perform pv_rate_limit('admin:' || auth.uid(), 120, interval '1 minute');
  return jsonb_build_object(
    'pending',   (select count(*) from payments where status = 'pending'),
    'confirmed', (select count(*) from submissions where status = 'confirmed'),
    'unpaid',    (select count(*) from submissions where status in ('awaiting_payment', 'rejected')),
    'revenue',   (select coalesce(sum(amount_inr), 0) from payments where status = 'approved'),
    'users',     (select count(*) from profiles),
    'by_plan',   (select coalesce(jsonb_object_agg(pl.name, (select count(*) from submissions s where s.plan_id = pl.id and s.status = 'confirmed')), '{}'::jsonb) from plans pl),
    'emails_today', (select count(*) from notification_log where day = (now() at time zone 'Asia/Kolkata')::date)
  );
end $$;

create or replace function public.admin_review_payment(p_id uuid, p_approve boolean, p_note text default null)
returns boolean language plpgsql volatile security definer
set search_path = public as $$
declare
  pay payments;
begin
  perform pv_require_admin();
  perform pv_rate_limit('admin:' || auth.uid(), 120, interval '1 minute');
  select * into pay from payments where id = p_id and status = 'pending' for update;
  if not found then return false; end if;

  update payments
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(btrim(coalesce(p_note, '')), ''),
         reviewed_by = auth.jwt() ->> 'email',
         reviewed_at = now()
   where id = p_id;

  update submissions
     set status = case when p_approve then 'confirmed'::submission_status else 'rejected'::submission_status end,
         confirmed_at = case when p_approve then now() else null end
   where id = pay.submission_id;

  insert into admin_audit (admin_email, action, payment_id, details)
  values (auth.jwt() ->> 'email', case when p_approve then 'approve' else 'reject' end, p_id,
          jsonb_build_object('razorpay_payment_id', pay.razorpay_payment_id, 'amount_inr', pay.amount_inr, 'note', p_note));

  -- A new Anugraham member gets today's message right away (if the daily
  -- email job is installed; see supabase/02_daily_email.sql).
  if p_approve and exists (select 1 from plans where id = pay.plan_id and includes_daily)
     and exists (select 1 from pg_proc where proname = 'pv_send_daily') then
    begin
      execute 'select public.pv_send_daily($1)' using pay.user_id;
    exception when others then
      raise warning 'daily email failed: %', sqlerrm;
    end;
  end if;
  return true;
end $$;

-- ─── Grants ─────────────────────────────────────────────────────────
revoke all on public.submissions, public.submission_files, public.payments, public.blessings,
              public.return_gifts, public.daily_messages, public.notification_log,
              public.app_admins, public.app_settings, public.admin_audit, public.rate_limits
  from anon, authenticated;
revoke execute on function public.pv_rate_limit(text, integer, interval) from public, anon, authenticated;

revoke execute on function public.pv_new_code(), public.pv_next_blessing() from public, anon, authenticated;
grant execute on function public.create_submission(text, text, text) to authenticated;
grant execute on function public.seal_submission(text, jsonb)         to authenticated;
grant execute on function public.submit_payment(text, text)           to authenticated;
grant execute on function public.my_submissions()                     to authenticated;
grant execute on function public.open_submission(text)                to authenticated;
grant execute on function public.is_admin()                           to authenticated;
grant execute on function public.admin_payments(text)                 to authenticated;
grant execute on function public.admin_stats()                        to authenticated;
grant execute on function public.admin_review_payment(uuid, boolean, text) to authenticated;
grant execute on function public.pv_unlock_at()                       to anon, authenticated;
revoke execute on function public.create_submission(text, text, text), public.seal_submission(text, jsonb),
                           public.submit_payment(text, text), public.my_submissions(), public.open_submission(text),
                           public.admin_payments(text), public.admin_stats(), public.admin_review_payment(uuid, boolean, text)
  from anon;

-- ─── Query time limits ──────────────────────────────────────────────
-- A runaway or abusive query is cancelled instead of tying up the database.
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';

-- ─── Storage ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('belongings', 'belongings', false, 52428800),     -- 50 MB per file
       ('gifts', 'gifts', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Upload: only into your own draft submission's folder, before the unlock.
create or replace function public.pv_can_upload(p_path text)
returns boolean language sql stable security definer
set search_path = public as $$
  select now() < pv_unlock_at()
     and p_path ~ '^PV-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/[0-9]{2}-[A-Za-z0-9._-]{1,80}$'
     and exists (
       select 1 from submissions s
        where s.code = split_part(p_path, '/', 1)
          and s.user_id = auth.uid()
          and s.status = 'draft'
          and s.created_at > now() - interval '6 hours'
     )
     and (select count(*) from storage.objects o
           where o.bucket_id = 'belongings' and o.name like split_part(p_path, '/', 1) || '/%') < 20
$$;

-- Read: only your own confirmed submission, and only from Vijayadashami.
create or replace function public.pv_can_read(p_path text)
returns boolean language sql stable security definer
set search_path = public as $$
  select now() >= pv_unlock_at() and exists (
    select 1 from submissions s
     where s.code = split_part(p_path, '/', 1)
       and s.user_id = auth.uid()
       and s.status = 'confirmed'
  )
$$;

-- Gifts: anyone with a confirmed Prasadam/Anugraham submission, from Vijayadashami.
create or replace function public.pv_can_read_gift()
returns boolean language sql stable security definer
set search_path = public as $$
  select now() >= pv_unlock_at() and exists (
    select 1 from submissions s join plans p on p.id = s.plan_id
     where s.user_id = auth.uid() and s.status = 'confirmed' and p.includes_gift
  )
$$;

grant execute on function public.pv_can_upload(text), public.pv_can_read(text), public.pv_can_read_gift() to authenticated;

drop policy if exists "pv2: upload own belongings" on storage.objects;
create policy "pv2: upload own belongings" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'belongings' and public.pv_can_upload(name));

drop policy if exists "pv2: read own belongings after unlock" on storage.objects;
create policy "pv2: read own belongings after unlock" on storage.objects
  for select to authenticated
  using (bucket_id = 'belongings' and public.pv_can_read(name));

drop policy if exists "pv2: read gifts after unlock" on storage.objects;
create policy "pv2: read gifts after unlock" on storage.objects
  for select to authenticated
  using (bucket_id = 'gifts' and public.pv_can_read_gift());
