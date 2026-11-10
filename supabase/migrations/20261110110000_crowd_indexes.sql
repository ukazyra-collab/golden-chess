-- Ready for a crowd: indexes for the queries that run all the time once many people play.
-- leaderboard and a player's place: ratings of one pool, best first (only rated players)
create index if not exists ratings_pool_top on public.ratings (pool, rating desc) where games > 0;
-- a player's game as host (liveGame, abortWaiting); also covers the games.host_id foreign key
create index if not exists games_host_id on public.games (host_id);
-- who is around (lobby): heartbeats of the last minutes
create index if not exists seen_at on public.seen (at desc);
