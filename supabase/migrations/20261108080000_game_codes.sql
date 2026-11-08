-- A friend invite gets a 4-digit code, said out loud instead of sending a link. Unique among the games still waiting
-- for their friend (a code is free again once its game started or was cancelled).
alter table public.games add column if not exists code text;
create unique index if not exists games_waiting_code on public.games (code) where status = 'waiting' and code is not null;
