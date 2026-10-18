
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
  if now() >= pv_unlock_at() then raise exception 'SUBMISSIONS_CLOSED'; end if;
  if not exists (select 1 from plans where id = p_plan and active) then raise exception 'UNKNOWN_PLAN'; end if;
  if (select count(*) from submissions where user_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'TOO_MANY_SUBMISSIONS';
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
  select * into s from submissions
   where code = p_code and user_id = pv_require_user() and status = 'draft'
   for update;
  if not found or now() >= pv_unlock_at() then return false; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 20 then
    raise exception 'INVALID_FILES';
  end if;
  if jsonb_array_length(p_files) = 0 and s.note is null then raise exception 'EMPTY_SUBMISSION'; end if;

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
  select * into s from submissions
   where code = p_code and user_id = pv_require_user()
     and status in ('awaiting_payment', 'rejected')
   for update;
  if not found then return false; end if;
  if pid !~ '^pay_[A-Za-z0-9]{14}$' then raise exception 'INVALID_PAYMENT_ID'; end if;
  if exists (select 1 from payments where razorpay_payment_id = pid) then raise exception 'PAYMENT_ID_USED'; end if;

  insert into payments (submission_id, user_id, plan_id, amount_inr, razorpay_payment_id)
  select s.id, s.user_id, s.plan_id, p.price_inr, pid from plans p where p.id = s.plan_id;
  update submissions set status = 'payment_review' where id = s.id;
  return true;
end $$;

-- 4. Everything the signed-in user has submitted.
create or replace function public.my_submissions()
returns jsonb language sql stable security definer
set search_path = public as $$
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
  ) r
$$;

-- 5. Open a submission on Vijayadashami (owner only, payment confirmed).
create or replace function public.open_submission(p_code text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  s submissions;
  p plans;
begin
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

-- ─── Admin functions ────────────────────────────────────────────────
create or replace function public.pv_require_admin()
returns void language plpgsql stable security definer
set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
end $$;

create or replace function public.admin_payments(p_status text default 'pending')
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  perform pv_require_admin();
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
    ) r), '[]'::jsonb);
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  perform pv_require_admin();
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
              public.app_admins, public.app_settings
  from anon, authenticated;

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

-- ─── Storage ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('belongings', 'belongings', false, 52428800),     -- 50 MB per file
       ('gifts', 'gifts', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Upload: only into your own draft submission's folder, before the unlock.
create or replace function public.pv_can_upload(p_path text)
returns boolean language sql stable security definer
set search_path = public as $$
  select now() < pv_unlock_at() and exists (
    select 1 from submissions s
     where s.code = split_part(p_path, '/', 1)
       and s.user_id = auth.uid()
       and s.status = 'draft'
       and s.created_at > now() - interval '6 hours'
  )
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
