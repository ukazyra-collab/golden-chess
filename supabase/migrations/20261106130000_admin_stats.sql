-- Statistics for the owner (Profile → Statistics): how many accounts, how they signed in, who plays online and how much.
-- admin_stats() answers only the accounts in `admins`; everything it counts leaves house players out.
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
grant all on public.admins to service_role;
-- the owner's accounts (only where they exist: the test database has none)
insert into public.admins (user_id)
  select id from public.profiles where id in ('5cc68fc8-0e62-4dc5-8d91-4ade2083e842', '8c6e6d98-6a62-465f-b780-18bcff10f2fc')
  on conflict (user_id) do nothing;

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
  ) into out;
  return out;
end
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
