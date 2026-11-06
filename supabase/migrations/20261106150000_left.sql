-- Leaving a game. A player's device tells the play function it has the game in front of it every few seconds (`seen`);
-- it stays quiet while the app is in the background. The side to move whose device has been quiet for 20 s (and whose
-- turn is that old) has left and loses (games.reason 'left'); during the opponent's turn one may be away as long as
-- one likes. Only the server reads and writes this table.
create table if not exists public.seen (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null,
  at timestamptz not null default now(),
  primary key (game_id, user_id)
);
alter table public.seen enable row level security; -- no policies: the play function reaches it as the database owner

create or replace function public.gc_house_pair(p_user uuid, p_tc text, p_pool text, p_rating double precision, p_rated boolean,
  p_base int, p_inc int, p_start_fen text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  g_id uuid;
  last_opp uuid;
  hr int;
  w uuid; b uuid;
  wname text; bname text;
  wr int; br int;
  hour int := extract(hour from now())::int;
begin
  perform pg_advisory_xact_lock(424242);
  select id into g_id from games
    where status = 'playing' and (white_id = p_user or black_id = p_user)
    order by created_at desc limit 1;
  if g_id is not null then
    delete from seeks where user_id = p_user;
    return jsonb_build_object('game', g_id);
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
    values (w, b, wname, bname, coalesce(wr, round(h.rating)::int), coalesce(br, round(h.rating)::int),
            p_base, p_inc, p_pool, p_rated, p_start_fen, p_start_fen, p_base, p_base,
            case when w = h.user_id then 'w' else 'b' end, h.style || jsonb_build_object('level', h.level))
    returning id into g_id;
  return jsonb_build_object('game', g_id, 'house', h.user_id);
end
$$;
