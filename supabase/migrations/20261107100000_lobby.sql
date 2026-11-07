-- "N players online · M games on" in the search dialog (the play function's `lobby`): who is around is read from
-- profiles.last_seen (set by `hello`, i.e. when the app opens), the game heartbeats (`seen`) and the fresh seeks.
alter table public.profiles add column if not exists last_seen timestamptz;
create index if not exists profiles_last_seen on public.profiles (last_seen desc) where last_seen is not null;
