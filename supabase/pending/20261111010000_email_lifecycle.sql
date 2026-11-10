-- Lifecycle emails. PROTOTYPE: not applied to the production database (see 20261111000000_fair_play.sql on how the
-- pending folder works). With it: the player's yes / no to emails, their language and time zone, when a guest saved
-- the account, the log of what was sent, and who is due which email (mail_due) for the mail function.

alter table public.profiles add column if not exists email_opt boolean;      -- yes / no to emails about their games (null: never asked)
alter table public.profiles add column if not exists email_opt_at timestamptz;
alter table public.profiles add column if not exists lang text not null default 'en';
alter table public.profiles add column if not exists tz text;                 -- the device's IANA zone ('Asia/Dubai'): emails at a sensible hour
alter table public.profiles add column if not exists saved_at timestamptz;    -- when the guest saved the account (the welcome email)
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('en', 'ru'));

-- the moment a guest becomes a saved account
create or replace function public.gc_saved_at() returns trigger language plpgsql as $$
begin
  if old.is_guest and not new.is_guest and new.saved_at is null then new.saved_at := now(); end if;
  return new;
end $$;
drop trigger if exists profiles_saved_at on public.profiles;
create trigger profiles_saved_at before update of is_guest on public.profiles for each row execute function public.gc_saved_at();

-- the player's language, time zone and yes / no (the play function's `prefs`); a zone Postgres doesn't know is ignored
create or replace function public.gc_prefs(uid uuid, p_lang text, p_tz text, p_opt boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r profiles;
begin
  update profiles p set
    lang = case when p_lang in ('en', 'ru') then p_lang else p.lang end,
    tz = case when p_tz is not null and exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else p.tz end,
    email_opt = coalesce(p_opt, p.email_opt),
    email_opt_at = case when p_opt is not null and p_opt is distinct from p.email_opt then now() else p.email_opt_at end
  where p.id = uid returning * into r;
  return jsonb_build_object('lang', r.lang, 'tz', r.tz, 'email_opt', r.email_opt);
end $$;

create table if not exists public.mail_outbox (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'weekly', 'winback7', 'winback21')),
  to_email text not null,
  subject text not null,
  status text not null check (status in ('dry', 'sent', 'failed')),  -- dry: rendered and logged, not sent (MAIL_MODE=dry)
  provider_id text,
  error text,
  created_at timestamptz not null default now());
create index if not exists mail_outbox_user_kind on public.mail_outbox (user_id, kind, created_at desc);
alter table public.mail_outbox enable row level security;
grant all on public.mail_outbox to service_role;
grant usage, select on sequence public.mail_outbox_id_seq to service_role;

-- who is due an email of this kind in the hour this runs (the mail function runs every hour):
--   welcome    saved the account in the last two days, never welcomed; between 9:00 and 21:00 their time
--   weekly     said yes; Sunday 18:00 their time; played in the last 7 days; none in the last 6 days
--   winback7   said yes; 18:00 their time; last seen exactly 7 days ago; none in the last 30 days
--   winback21  said yes; 18:00 their time; last seen exactly 21 days ago; none in the last 60 days
-- (p_now: the time it runs for, a parameter so the tests can pick the day and hour)
-- with what the email needs: the main pool and rating, the active days of the last 60 (the streak), the week's games
create or replace function public.mail_due(p_kind text, lim int, p_now timestamptz default now()) returns jsonb
language sql stable security definer set search_path = public, auth as $$
  with base as (
    select p.id, p.username, p.lang, u.email, p.email_opt, p.saved_at,
           (p_now at time zone coalesce(p.tz, 'UTC')) as local_now
      from profiles p join auth.users u on u.id = p.id
     where not p.is_guest and not p.house and u.email is not null and u.email <> ''),
  sent as (select user_id, kind, max(created_at) as at from mail_outbox where status <> 'failed' group by user_id, kind),
  seen as (select user_id, max(day) as last_day from activity group by user_id),
  due as (
    select b.* from base b left join sent s on s.user_id = b.id and s.kind = p_kind left join seen a on a.user_id = b.id
     where case p_kind
       when 'welcome' then b.saved_at > p_now - interval '2 days' and s.at is null and extract(hour from b.local_now) between 9 and 20
       when 'weekly' then b.email_opt and extract(isodow from b.local_now) = 7 and extract(hour from b.local_now) = 18
         and (s.at is null or s.at < p_now - interval '6 days')
         and exists (select 1 from games g where g.status = 'over' and (g.white_id = b.id or g.black_id = b.id) and g.updated_at > p_now - interval '7 days')
       when 'winback7' then b.email_opt and extract(hour from b.local_now) = 18 and a.last_day = (p_now at time zone 'utc')::date - 7
         and (s.at is null or s.at < p_now - interval '30 days')
       when 'winback21' then b.email_opt and extract(hour from b.local_now) = 18 and a.last_day = (p_now at time zone 'utc')::date - 21
         and (s.at is null or s.at < p_now - interval '60 days')
       else false end
     limit lim)
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', d.id, 'name', d.username, 'lang', d.lang, 'email', d.email, 'local_day', d.local_now::date,
    'pool', mp.pool, 'rating', round(mp.rating)::int,
    'days', (select coalesce(jsonb_agg(x.day order by x.day), '[]'::jsonb) from activity x where x.user_id = d.id and x.day > (p_now at time zone 'utc')::date - 60),
    'week', case when p_kind = 'weekly' then (
      select jsonb_build_object(
        'games', count(*),
        'wins', count(*) filter (where (g.white_id = d.id and g.result = '1-0') or (g.black_id = d.id and g.result = '0-1')),
        'draws', count(*) filter (where g.result = '1/2-1/2'),
        'losses', count(*) filter (where (g.white_id = d.id and g.result = '0-1') or (g.black_id = d.id and g.result = '1-0')),
        'from', (select case when f.white_id = d.id then f.white_after - f.white_diff else f.black_after - f.black_diff end from games f
                  where f.status = 'over' and f.rated and f.pool = mp.pool and (f.white_id = d.id or f.black_id = d.id) and f.updated_at > p_now - interval '7 days'
                  order by f.updated_at limit 1),
        'best', (select jsonb_build_object('opp', case when b.white_id = d.id then b.black_name else b.white_name end,
                   'rating', case when b.white_id = d.id then b.black_rating else b.white_rating end) from games b
                  where b.status = 'over' and b.updated_at > p_now - interval '7 days'
                    and ((b.white_id = d.id and b.result = '1-0') or (b.black_id = d.id and b.result = '0-1'))
                  order by case when b.white_id = d.id then b.black_rating else b.white_rating end desc nulls last limit 1))
      from games g where g.status = 'over' and (g.white_id = d.id or g.black_id = d.id) and g.updated_at > p_now - interval '7 days')
      else null end)), '[]'::jsonb)
  from due d
  left join lateral (select r.pool, r.rating from ratings r where r.user_id = d.id order by r.games desc, r.rating desc limit 1) mp on true
$$;

revoke execute on function public.mail_due(text, int, timestamptz) from public, anon, authenticated;
revoke execute on function public.gc_prefs(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mail_due(text, int, timestamptz), public.gc_prefs(uuid, text, text, boolean) to service_role;

-- Once it is live, the hourly run (pg_cron + pg_net, both available on Supabase; the key lives in the Vault):
--   select vault.create_secret('<a long random string, also set as MAIL_CRON_KEY on the mail function>', 'mail_cron_key');
--   select cron.schedule('mail-hourly', '5 * * * *', $job$
--     select net.http_post(url := 'https://wduoqpoqbtpkrgbcsegg.supabase.co/functions/v1/mail',
--       headers := jsonb_build_object('content-type', 'application/json',
--         'x-mail-key', (select decrypted_secret from vault.decrypted_secrets where name = 'mail_cron_key')),
--       body := '{}'::jsonb) $job$);
