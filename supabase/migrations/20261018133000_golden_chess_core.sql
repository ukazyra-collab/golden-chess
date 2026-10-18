-- Golden Chess online: players, ratings, games, matchmaking.
-- Clients only read; every write goes through the `play` edge function (service role).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  is_guest boolean not null default true,
  created_at timestamptz not null default now(),
  constraint username_len check (char_length(username) between 2 and 24)
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create table if not exists public.ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pool text not null check (pool in ('bullet', 'blitz', 'rapid')),
  rating double precision not null default 1500,
  rd double precision not null default 350,
  vol double precision not null default 0.06,
  games int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, pool)
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'playing' check (status in ('waiting', 'playing', 'over', 'aborted')),
  white_id uuid references public.profiles(id) on delete set null,
  black_id uuid references public.profiles(id) on delete set null,
  white_name text,
  black_name text,
  white_rating int,
  black_rating int,
  host_id uuid references public.profiles(id) on delete set null,
  host_color text check (host_color in ('w', 'b', 'r')),
  tc_base int not null,
  tc_inc int not null,
  pool text not null check (pool in ('bullet', 'blitz', 'rapid')),
  rated boolean not null default true,
  start_fen text not null,
  moves text[] not null default '{}',
  sans text[] not null default '{}',
  fen text not null,
  clock_w int not null,
  clock_b int not null,
  turn_started_at timestamptz,
  result text,
  reason text,
  white_diff int,
  black_diff int,
  white_after int,
  black_after int,
  draw_offer text check (draw_offer in ('w', 'b')),
  rematch_offer text check (rematch_offer in ('w', 'b')),
  rematch_game uuid,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_white_live on public.games (white_id) where status in ('playing', 'waiting');
create index if not exists games_black_live on public.games (black_id) where status = 'playing';
create index if not exists games_recent on public.games (updated_at desc);

create table if not exists public.seeks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tc text not null,
  pool text not null,
  rating double precision not null,
  rated boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.ratings enable row level security;
alter table public.games enable row level security;
alter table public.seeks enable row level security;

drop policy if exists "anyone can read profiles" on public.profiles;
drop policy if exists "anyone can read ratings" on public.ratings;
drop policy if exists "anyone can read games" on public.games;
create policy "anyone can read profiles" on public.profiles for select using (true);
create policy "anyone can read ratings" on public.ratings for select using (true);
create policy "anyone can read games" on public.games for select using (true);

grant select on public.profiles, public.ratings, public.games to anon, authenticated;
grant all on public.profiles, public.ratings, public.games, public.seeks to service_role;

-- Atomic matchmaking: join the closest-rated fresh seek with the same time control, or leave our own seek.
create or replace function public.gc_pair(p_user uuid, p_tc text, p_pool text, p_rating double precision, p_rated boolean,
  p_base int, p_inc int, p_start_fen text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  opp record;
  g_id uuid;
  w uuid; b uuid;
  wname text; bname text;
  wr int; br int;
begin
  perform pg_advisory_xact_lock(424242);
  select id into g_id from games
    where status = 'playing' and (white_id = p_user or black_id = p_user)
    order by created_at desc limit 1;
  if g_id is not null then
    delete from seeks where user_id = p_user;
    return jsonb_build_object('game', g_id);
  end if;
  select * into opp from seeks
    where tc = p_tc and rated = p_rated and user_id <> p_user and updated_at > now() - interval '30 seconds'
    order by abs(rating - p_rating) asc, updated_at asc
    limit 1;
  if not found then
    insert into seeks (user_id, tc, pool, rating, rated, updated_at)
      values (p_user, p_tc, p_pool, p_rating, p_rated, now())
      on conflict (user_id) do update
        set tc = excluded.tc, pool = excluded.pool, rating = excluded.rating, rated = excluded.rated, updated_at = now();
    return jsonb_build_object('waiting', true);
  end if;
  delete from seeks where user_id in (opp.user_id, p_user);
  if random() < 0.5 then w := p_user; b := opp.user_id; else w := opp.user_id; b := p_user; end if;
  select username into wname from profiles where id = w;
  select username into bname from profiles where id = b;
  select round(rating)::int into wr from ratings where user_id = w and pool = p_pool;
  select round(rating)::int into br from ratings where user_id = b and pool = p_pool;
  insert into games (white_id, black_id, white_name, black_name, white_rating, black_rating,
                     tc_base, tc_inc, pool, rated, start_fen, fen, clock_w, clock_b)
    values (w, b, wname, bname, coalesce(wr, 1500), coalesce(br, 1500),
            p_base, p_inc, p_pool, p_rated, p_start_fen, p_start_fen, p_base, p_base)
    returning id into g_id;
  return jsonb_build_object('game', g_id, 'opponent', opp.user_id);
end
$$;
revoke execute on function public.gc_pair(uuid, text, text, double precision, boolean, int, int, text) from public, anon, authenticated;
grant execute on function public.gc_pair(uuid, text, text, double precision, boolean, int, int, text) to service_role;

-- Realtime (private channels): signed-in players may listen and share presence; only the server broadcasts.
do $$
begin
  execute 'drop policy if exists "golden chess listen" on realtime.messages';
  execute 'create policy "golden chess listen" on realtime.messages for select to authenticated using (true)';
  execute 'drop policy if exists "golden chess presence" on realtime.messages';
  execute 'create policy "golden chess presence" on realtime.messages for insert to authenticated with check (realtime.messages.extension = ''presence'')';
exception when others then
  raise notice 'realtime policies skipped: %', sqlerrm;
end
$$;
