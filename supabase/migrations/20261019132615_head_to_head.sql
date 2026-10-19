-- The score against each opponent over all of a player's finished games (the chips and the score card on the
-- history page). Games are public, so this runs with the caller's rights; the history indexes serve the filter.
create or replace function public.head_to_head(p_uid uuid)
returns table (opp_id uuid, opp_name text, wins integer, draws integer, losses integer, games integer, last_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.opp_id,
         (array_agg(t.opp_name order by t.updated_at desc))[1],
         (count(*) filter (where t.res = 1))::integer,
         (count(*) filter (where t.res = 0))::integer,
         (count(*) filter (where t.res = -1))::integer,
         count(*)::integer,
         max(t.updated_at)
  from (
    select case when g.white_id = p_uid then g.black_id else g.white_id end as opp_id,
           case when g.white_id = p_uid then g.black_name else g.white_name end as opp_name,
           case when g.result = '1/2-1/2' then 0
                when (g.result = '1-0') = (g.white_id = p_uid) then 1
                else -1 end as res,
           g.updated_at
    from public.games g
    where g.status = 'over' and (g.white_id = p_uid or g.black_id = p_uid)
  ) t
  group by t.opp_id
  order by count(*) desc, max(t.updated_at) desc;
$$;
grant execute on function public.head_to_head(uuid) to anon, authenticated;
