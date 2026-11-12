-- Fair play. PROTOTYPE: not applied to the production database. Files in supabase/pending/ are applied by the local
-- tests only (test/server/pg-harness.mjs); one moves to supabase/migrations/ when it is applied (the GitHub
-- integration applies that folder on a push to main), and the play function then runs with GC_FAIR=on.
--
-- What it keeps: the time each move took (games.mt, measured by the server), how often a player's device left the
-- game during their own turn (fair_blurs, the device's word), players' reports, the scan's numbers (fair_scores), the
-- owner's decision on a player (profiles.fair) and the rating given back to the opponents of a closed account.

alter table public.games add column if not exists mt int[];  -- ms each move took, from the start of the turn (-1: unknown)
alter table public.profiles add column if not exists fair text not null default 'ok' check (fair in ('ok', 'watch', 'closed'));

create table if not exists public.fair_blurs (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ply int not null,
  n int not null default 1,           -- times the window or the app was left during that turn
  away_ms int not null default 0,     -- for how long in all
  at timestamptz not null default now());
create index if not exists fair_blurs_user on public.fair_blurs (user_id, at desc);
create index if not exists fair_blurs_game on public.fair_blurs (game_id);

create table if not exists public.reports (
  id bigserial primary key,
  at timestamptz not null default now(),
  reporter uuid not null references public.profiles(id) on delete cascade,
  accused uuid not null references public.profiles(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  why text not null check (why in ('engine', 'abuse', 'other')),
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'cleared', 'confirmed')),
  handled_by uuid,
  handled_at timestamptz,
  unique (reporter, game_id));
create index if not exists reports_accused on public.reports (accused, status);
create index if not exists reports_reporter_at on public.reports (reporter, at desc);

-- what the scan found (tools/fairplay/score.js): one row per player per scan
create table if not exists public.fair_scores (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  games int not null,
  moves int not null,                 -- the moves that say something (no opening, no decided positions, no forced moves)
  t1 real not null,                   -- share of them that were the engine's first choice
  acpl real not null,                 -- average loss per move, centipawns
  big int not null,                   -- moves that lost 3 pawns or more
  joker_chances int not null default 0,
  joker_found int not null default 0,
  joker_blind int not null default 0, -- a winning Joker Move there, the best ordinary move played instead
  z real not null,                    -- T1 above people of that rating, in standard deviations of the mean over that many moves
  verdict text not null check (verdict in ('ok', 'watch', 'review')),
  detail jsonb not null default '{}');
create index if not exists fair_scores_user on public.fair_scores (user_id, at desc);

-- the rating given back once per game to the opponent of a closed account
create table if not exists public.fair_refunds (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pool text not null,
  points int not null,
  at timestamptz not null default now(),
  primary key (game_id, user_id));

-- only the play function (service role) reads and writes these: no policies
alter table public.fair_blurs enable row level security;
alter table public.reports enable row level security;
alter table public.fair_scores enable row level security;
alter table public.fair_refunds enable row level security;
grant all on public.fair_blurs, public.reports, public.fair_scores, public.fair_refunds to service_role;
grant usage, select on sequence public.fair_blurs_id_seq, public.reports_id_seq, public.fair_scores_id_seq to service_role;

-- a closed account is out of the leaderboard for everyone (the app also reads ratings directly)
drop policy if exists "anyone can read ratings" on public.ratings;
create policy "anyone can read ratings" on public.ratings for select using (
  not exists (select 1 from public.profiles p where p.id = ratings.user_id and p.fair = 'closed'));

-- a report: once a game per reporter ({again}), at most lim a day ({limited})
create or replace function public.fair_report(rep uuid, acc uuid, gid uuid, why text, note text, lim int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from reports where reporter = rep and game_id = gid) then return '{"again": true}'::jsonb; end if;
  if (select count(*) from reports where reporter = rep and at > now() - interval '1 day') >= lim then return '{"limited": true}'::jsonb; end if;
  insert into reports (reporter, accused, game_id, why, note) values (rep, acc, gid, why, coalesce(note, '')) on conflict (reporter, game_id) do nothing;
  return '{}'::jsonb;
end $$;

-- the owner's list: players with open reports, flagged by the scan, or on watch; the most reported first
create or replace function public.fair_list(lim int) returns jsonb
language sql stable security definer set search_path = public as $$
  with agg as (
    select accused as uid, count(*) filter (where status = 'open') as open, count(*) as reports, count(distinct reporter) as reporters,
      max(at) as last_at, array_agg(distinct game_id) filter (where game_id is not null) as games
    from reports group by accused),
  whys as (select uid, jsonb_object_agg(why, n) as why from (select accused as uid, why, count(*) as n from reports group by accused, why) w group by uid),
  sc as (select distinct on (user_id) * from fair_scores order by user_id, at desc),
  ids as (select uid from agg union select user_id from sc union select id from profiles where fair = 'watch')
  select coalesce(jsonb_agg(to_jsonb(x) - 'zz' order by x.open desc, x.zz desc nulls last), '[]'::jsonb) from (
    select ids.uid, p.username as name, p.fair, coalesce(a.open, 0) as open, coalesce(a.reports, 0) as reports, coalesce(a.reporters, 0) as reporters,
      coalesce(w.why, '{}'::jsonb) as why, coalesce(to_jsonb(a.games), '[]'::jsonb) as games, a.last_at,
      case when sc.user_id is null then null else to_jsonb(sc) - 'id' - 'user_id' end as score, sc.z as zz
    from ids join profiles p on p.id = ids.uid
    left join agg a on a.uid = ids.uid left join whys w on w.uid = ids.uid left join sc on sc.user_id = ids.uid
    where coalesce(a.open, 0) > 0 or (sc.user_id is not null and sc.verdict <> 'ok') or p.fair = 'watch'
    order by coalesce(a.open, 0) desc, sc.z desc nulls last
    limit lim) x
$$;

-- the owner's decision: 'ok' clears the open reports, 'watch' keeps them, 'closed' confirms them, takes the account out
-- of matchmaking and gives its opponents back the rating they lost to it in the last 30 days (once per game)
create or replace function public.fair_set(target uuid, state text, by_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  update profiles set fair = state where id = target;
  if state <> 'watch' then
    update reports set status = case when state = 'closed' then 'confirmed' else 'cleared' end, handled_by = by_uid, handled_at = now()
      where accused = target and status = 'open';
  end if;
  if state = 'closed' then
    delete from seeks where user_id = target;
    for r in
      select g.id, g.pool,
             case when g.white_id = target then g.black_id else g.white_id end as victim,
             case when g.white_id = target then g.black_diff else g.white_diff end as lost
        from games g
       where (g.white_id = target or g.black_id = target) and g.rated and g.status = 'over' and g.updated_at > now() - interval '30 days'
    loop
      continue when r.victim is null or r.lost is null or r.lost >= 0;
      continue when exists (select 1 from profiles where id = r.victim and fair = 'closed');
      insert into fair_refunds (game_id, user_id, pool, points) values (r.id, r.victim, r.pool, -r.lost) on conflict do nothing;
      if found then
        update ratings set rating = rating - r.lost where user_id = r.victim and pool = r.pool;
        n := n + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('refunds', n);
end $$;

revoke execute on function public.fair_report(uuid, uuid, uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.fair_list(int) from public, anon, authenticated;
revoke execute on function public.fair_set(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fair_report(uuid, uuid, uuid, text, text, int), public.fair_list(int), public.fair_set(uuid, text, uuid) to service_role;
