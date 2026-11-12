-- Tidy after email_lifecycle (the database advisor's notes): pg_net in the extensions schema rather than public, and a
-- fixed search_path for the trigger function. The hourly job calls net.http_post by name, so it needs no change.
alter function public.gc_saved_at() set search_path = public;
do $do$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end $do$;
