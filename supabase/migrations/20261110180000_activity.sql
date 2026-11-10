-- The day log: one row per player per day (UTC) with the platform last used and what they did (open, bot, online,
-- learn, local, friend). The owner's statistics read retention from it (D1, D7, back on a later day), people a day
-- by platform, and what was played this week. Written only by the game server (hello, act); nobody reads it directly.
create table if not exists public.activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  platform text not null default 'web',
  kinds text[] not null default '{}',
  primary key (user_id, day)
);
create index if not exists activity_day on public.activity (day);
alter table public.activity enable row level security;
revoke all on public.activity from anon, authenticated;
grant all on public.activity to service_role;

-- what we already know: the day each player came, the day last seen, the days of their online games
insert into public.activity (user_id, day, platform, kinds)
select x.u, x.d, 'unknown', array_agg(distinct x.k order by x.k) from (
  select id as u, (created_at at time zone 'utc')::date as d, 'open' as k from public.profiles where not house
  union all select id, (last_seen at time zone 'utc')::date, 'open' from public.profiles where not house and last_seen is not null
  union all select white_id, (created_at at time zone 'utc')::date, 'online' from public.games where white_id is not null and status in ('over', 'playing')
  union all select black_id, (created_at at time zone 'utc')::date, 'online' from public.games where black_id is not null and status in ('over', 'playing')
) x join public.profiles p on p.id = x.u and not p.house
group by x.u, x.d
on conflict (user_id, day) do nothing;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out jsonb;
  d7 timestamptz := now() - interval '7 days';
  d30 timestamptz := now() - interval '30 days';
begin
  if auth.uid() is null or not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  select jsonb_build_object(
    'accounts', (select count(*) from profiles where not house),
    'registered', (select count(*) from profiles where not house and not is_guest),
    'guests', (select count(*) from profiles where not house and is_guest),
    'house', (select count(*) from profiles where house),
    'methods', (select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb) from
      (select i.provider, count(*) as n from auth.identities i join profiles p on p.id = i.user_id where not p.house group by i.provider) m),
    'new7', (select count(*) from profiles where not house and created_at > d7),
    'new30', (select count(*) from profiles where not house and created_at > d30),
    'games', (select count(*) from games where status = 'over'),
    'games7', (select count(*) from games where status = 'over' and updated_at > d7),
    'games30', (select count(*) from games where status = 'over' and updated_at > d30),
    'games_house30', (select count(*) from games where status = 'over' and house is not null and updated_at > d30),
    'live', (select count(*) from games where status = 'playing'),
    'active7', (select count(distinct x.u) from (select white_id as u from games where status = 'over' and updated_at > d7
                union select black_id from games where status = 'over' and updated_at > d7) x join profiles p on p.id = x.u where not p.house),
    'active30', (select count(distinct x.u) from (select white_id as u from games where status = 'over' and updated_at > d30
                 union select black_id from games where status = 'over' and updated_at > d30) x join profiles p on p.id = x.u where not p.house),
    'returned', (select count(*) from (select x.u from (select white_id as u, updated_at::date as d from games where status = 'over'
                 union select black_id, updated_at::date from games where status = 'over') x join profiles p on p.id = x.u where not p.house
                 group by x.u having count(distinct x.d) >= 2) y),
    'pools', (select coalesce(jsonb_object_agg(pool, n), '{}'::jsonb) from (select pool, count(*) as n from games where status = 'over' and updated_at > d30 group by pool) q),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(s.d, 'YYYY-MM-DD'), 'games', s.g, 'new', s.n, 'players', s.pl) order by s.d), '[]'::jsonb) from (
      select gs.d::date as d,
        (select count(*) from games where status = 'over' and updated_at::date = gs.d::date) as g,
        (select count(*) from profiles where not house and created_at::date = gs.d::date) as n,
        (select count(distinct x.u) from (select white_id as u from games where status = 'over' and updated_at::date = gs.d::date
            union select black_id from games where status = 'over' and updated_at::date = gs.d::date) x join profiles p on p.id = x.u where not p.house) as pl
      from generate_series(d30::date, now()::date, interval '1 day') as gs(d)) s)
,
    -- from the day log (activity): people a day for two weeks by platform, retention, what they did this week
    'dau', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(s.d, 'YYYY-MM-DD'), 'n', s.n, 'ios', s.i, 'android', s.a, 'web', s.w) order by s.d), '[]'::jsonb) from (
      select gs.d::date as d,
        count(a.user_id) as n,
        count(a.user_id) filter (where a.platform = 'ios') as i,
        count(a.user_id) filter (where a.platform = 'android') as a,
        count(a.user_id) filter (where a.platform = 'web') as w
      from generate_series(current_date - 13, current_date, interval '1 day') as gs(d)
      left join activity a on a.day = gs.d::date and a.user_id in (select id from public.profiles pp where not pp.house and pp.id not in (select user_id from admins))
      group by gs.d) s),
    'ret', (select jsonb_build_object(
      'd1', jsonb_build_object('n', count(*) filter (where c.c <= current_date - 1 and exists (select 1 from activity a where a.user_id = c.id and a.day = c.c + 1)), 'of', count(*) filter (where c.c <= current_date - 1)),
      'd7', jsonb_build_object('n', count(*) filter (where c.c <= current_date - 7 and exists (select 1 from activity a where a.user_id = c.id and a.day = c.c + 7)), 'of', count(*) filter (where c.c <= current_date - 7)),
      'back', jsonb_build_object('n', count(*) filter (where c.c <= current_date - 1 and exists (select 1 from activity a where a.user_id = c.id and a.day > c.c)), 'of', count(*) filter (where c.c <= current_date - 1)))
      from (select pp.id, (pp.created_at at time zone 'utc')::date as c from public.profiles pp where not pp.house and pp.id not in (select user_id from admins)) c),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(c.c, 'YYYY-MM-DD'), 'size', c.size, 'd1', c.d1, 'd7', c.d7, 'back', c.back) order by c.c desc), '[]'::jsonb) from (
      select p.c, count(*) as size,
        count(*) filter (where exists (select 1 from activity a where a.user_id = p.id and a.day = p.c + 1)) as d1,
        count(*) filter (where exists (select 1 from activity a where a.user_id = p.id and a.day = p.c + 7)) as d7,
        count(*) filter (where exists (select 1 from activity a where a.user_id = p.id and a.day > p.c)) as back
      from (select pp.id, (pp.created_at at time zone 'utc')::date as c from public.profiles pp where not pp.house and pp.id not in (select user_id from admins)) p
      where p.c > current_date - 21 group by p.c) c),
    'kinds7', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select k, count(*) as n from activity a, unnest(a.kinds) k
      where a.day > current_date - 7 and a.user_id in (select id from public.profiles pp where not pp.house and pp.id not in (select user_id from admins)) group by k) q)
  ) into out;
  return out;
end
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
