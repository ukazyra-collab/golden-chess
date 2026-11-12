-- The game layer on the account. PROTOTYPE: not applied to the production database (see 20261111000000_fair_play.sql on
-- how the pending folder works); with it the play function runs with GC_PROG=on.
--
-- What it keeps: a player's progress as their device knows it (the level's XP, the career's stars, the Joker cards,
-- the puzzles solved, the days played), so that it follows the account to another device; and the XP on the profile,
-- where anyone can read it: the rank badge next to a player's name, as an opponent sees it. Games against the bots are
-- played on the device, so the server keeps what it is sent; it only bounds the size and the numbers.

alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles drop constraint if exists profiles_xp_check;
alter table public.profiles add constraint profiles_xp_check check (xp >= 0 and xp <= 5000000);

create table if not exists public.progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint progress_size check (pg_column_size(data) <= 32000)
);
alter table public.progress enable row level security; -- no policies: only the play function (service role) reads and writes it
grant all on public.progress to service_role;

-- the play function's `progress`: p_data null reads; otherwise it is kept (the device merged it with what it read here
-- first) and its XP goes on the profile
create or replace function public.gc_progress(uid uuid, p_data jsonb, p_xp integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r progress; x integer;
begin
  if p_data is not null then
    insert into progress as g (user_id, data, updated_at) values (uid, p_data, now())
      on conflict (user_id) do update set data = excluded.data, updated_at = now();
    update profiles set xp = greatest(0, least(5000000, coalesce(p_xp, 0))) where id = uid;
  end if;
  select * into r from progress where user_id = uid;
  select p.xp into x from profiles p where p.id = uid;
  return jsonb_build_object('data', r.data, 'xp', coalesce(x, 0), 'at', r.updated_at);
end $$;
revoke execute on function public.gc_progress(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.gc_progress(uuid, jsonb, integer) to service_role;
