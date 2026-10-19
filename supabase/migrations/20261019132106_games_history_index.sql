-- A player's finished games, newest first (the history list in the app):
--   where (white_id = $1 or black_id = $1) and status = 'over' order by updated_at desc limit 50
create index if not exists games_white_history on public.games (white_id, updated_at desc) where status = 'over';
create index if not exists games_black_history on public.games (black_id, updated_at desc) where status = 'over';
