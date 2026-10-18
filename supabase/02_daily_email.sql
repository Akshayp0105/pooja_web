-- ═══════════════════════════════════════════════════════════════════
--  Pooja Veppu  —  ₹30 Anugraham daily email (run AFTER 01_schema.sql)
--
--  Before running:
--   1. Create a free account at https://resend.com and an API key.
--   2. Replace re_XXXXXXXX below with that key.
--   3. To send to anyone (not just yourself), verify a domain in Resend
--      and set email_from, e.g.:
--        update app_settings set value = 'Pooja Veppu <hello@yourdomain.com>' where key = 'email_from';
--      Also set the live site address:
--        update app_settings set value = 'https://your-site.com' where key = 'site_url';
--
--  Every day at 6:00 AM IST, each confirmed Anugraham member receives that
--  day's good-morning message and slokam (days are in daily_messages).
--  notification_log guarantees at most one email per person per day.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Store the Resend key in Supabase Vault (encrypted), replacing any old one.
do $$
begin
  delete from vault.secrets where name = 'resend_api_key';
  perform vault.create_secret('re_XXXXXXXX', 'resend_api_key', 'Resend API key for Pooja Veppu daily emails');
end $$;

create or replace function public.pv_esc(t text)
returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function public.pv_daily_email_html(m public.daily_messages, p_name text, p_site text)
returns text language sql immutable as $$
  select format($html$
<!doctype html><html><body style="margin:0;background:#FBF4E8;font-family:Georgia,'Noto Serif Malayalam',serif;color:#2A1A12">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#FBF4E8;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border:1px solid #EAD9B8;border-radius:20px">
<tr><td style="padding:32px 32px 8px;text-align:center">
  <div style="font-size:13px;letter-spacing:3px;color:#8A621C;text-transform:uppercase;font-family:Arial,sans-serif">Pooja Veppu · പൂജവെയ്പ്</div>
  <h1 style="margin:14px 0 0;font-weight:normal;font-size:26px;color:#6A1F1B">%s</h1>
</td></tr>
<tr><td style="padding:16px 32px 0;font-size:17px;line-height:1.7;color:#6A1F1B">%s</td></tr>
<tr><td style="padding:10px 32px 0;font-size:16px;line-height:1.6;color:#5B4A3E;font-family:Arial,sans-serif">%s</td></tr>
<tr><td style="padding:24px 32px">
  <div style="background:#FFF4E3;border-radius:16px;padding:22px 22px 18px;text-align:center">
    <div style="font-size:19px;line-height:1.9;color:#6A1F1B">%s</div>
    <div style="margin-top:10px;font-size:15px;font-style:italic;line-height:1.6;color:#5B4A3E">%s</div>
    <div style="margin-top:14px;font-size:14px;line-height:1.6;color:#5B4A3E;font-family:Arial,sans-serif">%s</div>
    <div style="margin-top:10px;font-size:12px;color:#8A621C;font-family:Arial,sans-serif">%s</div>
  </div>
</td></tr>
<tr><td style="padding:0 32px 30px;text-align:center;font-family:Arial,sans-serif">
  <a href="%s" style="display:inline-block;background:#DD7420;color:#fff;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:14px;font-weight:bold">Open Pooja Veppu</a>
  <p style="margin:18px 0 0;font-size:12px;color:#8C7766">You receive this because you chose the Anugraham plan. Messages stop after Vijayadashami.</p>
</td></tr>
</table></td></tr></table></body></html>$html$,
    case when nullif(btrim(p_name), '') is null then 'സുപ്രഭാതം' else 'സുപ്രഭാതം, ' || pv_esc(p_name) end,
    pv_esc(m.greeting_ml),
    pv_esc(m.greeting_en),
    replace(pv_esc(m.slokam_ml), E'\n', '<br>'),
    replace(pv_esc(m.slokam_tr), E'\n', '<br>'),
    pv_esc(m.slokam_en),
    pv_esc(m.source),
    pv_esc(p_site))
$$;

-- Sends today's message to every confirmed Anugraham member not yet emailed
-- today (or to one user when p_user is given). Returns how many were queued.
create or replace function public.pv_send_daily(p_user uuid default null)
returns integer language plpgsql volatile security definer
set search_path = public, extensions as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  msg daily_messages;
  api_key text;
  sender text;
  site text;
  r record;
  req bigint;
  n integer := 0;
begin
  select * into msg from daily_messages where day = today;
  if not found then return 0; end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if api_key is null or api_key = 're_XXXXXXXX' then
    raise warning 'pv_send_daily: set the Resend key in supabase/02_daily_email.sql';
    return 0;
  end if;
  select value into sender from app_settings where key = 'email_from';
  select value into site from app_settings where key = 'site_url';

  for r in
    select distinct on (s.user_id) s.user_id, pr.email, coalesce(pr.full_name, s.devotee_name) as name
      from submissions s
      join plans pl on pl.id = s.plan_id
      join profiles pr on pr.id = s.user_id
     where s.status = 'confirmed' and pl.includes_daily and pr.email is not null
       and (p_user is null or s.user_id = p_user)
       and not exists (select 1 from notification_log l
                        where l.user_id = s.user_id and l.day = today and l.channel = 'email')
  loop
    -- Claim the slot first so a concurrent run can't send twice.
    begin
      insert into notification_log (user_id, day, channel, to_address)
      values (r.user_id, today, 'email', r.email);
    exception when unique_violation then
      continue;
    end;

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', sender,
        'to', jsonb_build_array(r.email),
        'subject', msg.subject,
        'html', pv_daily_email_html(msg, r.name, site)
      )
    ) into req;

    update notification_log set request_id = req
     where user_id = r.user_id and day = today and channel = 'email';
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.pv_send_daily(uuid) from public, anon, authenticated;

-- 6:00 AM IST = 00:30 UTC, every day.
do $$
begin
  perform cron.unschedule('pv-daily-email') where exists (select 1 from cron.job where jobname = 'pv-daily-email');
  perform cron.schedule('pv-daily-email', '30 0 * * *', 'select public.pv_send_daily()');
end $$;

-- Delivery results land in net._http_response; this view joins them to the log.
create or replace view public.pv_email_status as
  select l.day, l.to_address, l.created_at, r.status_code, r.content::text as response
    from public.notification_log l
    left join net._http_response r on r.id = l.request_id;
revoke all on public.pv_email_status from anon, authenticated;
