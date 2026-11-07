-- Quicker search (8 s of searching already feels long): with nobody else around the house player comes after 2-3 s
-- (the client's search span); while other people have the app open it waits at most 6 s of search (was 12) so people
-- still find each other first; the rating window between two people widens twice as fast (50 points a second).

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
  my_since timestamptz;
begin
  perform pg_advisory_xact_lock(424242);
  select id into g_id from games
    where status = 'playing' and (white_id = p_user or black_id = p_user)
    order by created_at desc limit 1;
  if g_id is not null then
    delete from seeks where user_id = p_user;
    return jsonb_build_object('game', g_id);
  end if;
  -- this search (same game, still alive) began at my_since; a new one begins now
  select since into my_since from seeks
    where user_id = p_user and tc = p_tc and rated = p_rated and updated_at > now() - interval '30 seconds';
  my_since := coalesce(my_since, now());
  select s.* into opp from seeks s
    where s.tc = p_tc and s.rated = p_rated and s.user_id <> p_user and s.updated_at > now() - interval '30 seconds'
      and abs(s.rating - p_rating) <= 150 + 50 * extract(epoch from now() - least(s.since, my_since))
    order by abs(s.rating - p_rating) asc, s.since asc
    limit 1;
  if not found then
    insert into seeks (user_id, tc, pool, rating, rated, updated_at, since)
      values (p_user, p_tc, p_pool, p_rating, p_rated, now(), my_since)
      on conflict (user_id) do update
        set tc = excluded.tc, pool = excluded.pool, rating = excluded.rating, rated = excluded.rated,
            updated_at = now(), since = excluded.since;
    return jsonb_build_object('waiting', true);
  end if;
  g_id := gc_pair_game(p_user, opp.user_id, p_pool, p_rated, p_base, p_inc, p_start_fen);
  return jsonb_build_object('game', g_id, 'opponent', opp.user_id);
end
$$;

create or replace function public.gc_house_pair(p_user uuid, p_tc text, p_pool text, p_rating double precision, p_rated boolean,
  p_base int, p_inc int, p_start_fen text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  opp record;
  g_id uuid;
  last_opp uuid;
  my_since timestamptz;
  w uuid; b uuid;
  wname text; bname text;
  wr int; br int;
  hour int := extract(hour from now())::int;
  house_wait constant int := 6; -- seconds of search before the house steps in while other people are around
begin
  perform pg_advisory_xact_lock(424242);
  select id into g_id from games
    where status = 'playing' and (white_id = p_user or black_id = p_user)
    order by created_at desc limit 1;
  if g_id is not null then
    delete from seeks where user_id = p_user;
    return jsonb_build_object('game', g_id);
  end if;
  -- a person searching for the same game comes before any house player, whatever the gap in rating
  select s.* into opp from seeks s
    where s.tc = p_tc and s.rated = p_rated and s.user_id <> p_user and s.updated_at > now() - interval '30 seconds'
    order by abs(s.rating - p_rating) asc, s.since asc
    limit 1;
  if found then
    g_id := gc_pair_game(p_user, opp.user_id, p_pool, p_rated, p_base, p_inc, p_start_fen);
    return jsonb_build_object('game', g_id, 'opponent', opp.user_id);
  end if;
  -- other people have the app open (and are not in a game): give them time to start a search too
  select since into my_since from seeks
    where user_id = p_user and tc = p_tc and rated = p_rated and updated_at > now() - interval '30 seconds';
  if now() - coalesce(my_since, now()) < make_interval(secs => house_wait) and exists (
      select 1 from profiles p
      where p.id <> p_user and not p.house and p.last_seen > now() - interval '2 minutes'
        and not exists (select 1 from games g where g.status = 'playing' and g.updated_at > now() - interval '10 minutes'
                          and (g.white_id = p.id or g.black_id = p.id))) then
    return jsonb_build_object('waiting', true);
  end if;
  delete from seeks where user_id = p_user;
  select case when white_id = p_user then black_id else white_id end into last_opp
    from games where (white_id = p_user or black_id = p_user) and status = 'over' order by updated_at desc limit 1;
  -- around at this hour and close in rating first, a different face than last time, a little chance in it
  select x.user_id, x.level, x.style, x.username, x.rating into h from (
    select hp.user_id, hp.level, hp.style, p.username, coalesce(r.rating, hp.target) as rating,
      (case when ((hour - hp.online_from + 24) % 24) < hp.online_hours then 0 else 1 end) as away,
      abs(coalesce(r.rating, hp.target) - p_rating) as dist
    from house hp join profiles p on p.id = hp.user_id
    left join ratings r on r.user_id = hp.user_id and r.pool = p_pool
    -- free: not in a live game that moved within the hour (a game whose human went away during the house player's turn
    -- waits for them; its house player is not kept from other games by it)
    where not exists (select 1 from games g where g.status = 'playing' and g.updated_at > now() - interval '1 hour'
                        and (g.white_id = hp.user_id or g.black_id = hp.user_id))
  ) x
  order by x.away + (case when x.dist > 250 then 1 else 0 end) + (case when x.user_id = last_opp then 2 else 0 end), x.dist + random() * 150
  limit 1;
  if not found then
    return jsonb_build_object('none', true);
  end if;
  if random() < 0.5 then w := p_user; b := h.user_id; else w := h.user_id; b := p_user; end if;
  select username into wname from profiles where id = w;
  select username into bname from profiles where id = b;
  select round(rating)::int into wr from ratings where user_id = w and pool = p_pool;
  select round(rating)::int into br from ratings where user_id = b and pool = p_pool;
  insert into games (white_id, black_id, white_name, black_name, white_rating, black_rating,
                     tc_base, tc_inc, pool, rated, start_fen, fen, clock_w, clock_b, house, house_style)
    values (w, b, wname, bname,
            coalesce(wr, case when w = p_user then round(p_rating)::int else round(h.rating)::int end), -- a player without a rating row yet: their default, not the house player's
            coalesce(br, case when b = p_user then round(p_rating)::int else round(h.rating)::int end),
            p_base, p_inc, p_pool, p_rated, p_start_fen, p_start_fen, p_base, p_base,
            case when w = h.user_id then 'w' else 'b' end, h.style || jsonb_build_object('level', h.level))
    returning id into g_id;
  return jsonb_build_object('game', g_id, 'house', h.user_id);
end
$$;
