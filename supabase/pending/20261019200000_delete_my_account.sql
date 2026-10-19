-- A player deletes their own account (the stores require it inside the app). Their sign-in, profile, ratings and seek
-- go (foreign keys cascade from auth.users); finished games stay, with the player's name, for the opponents' history.
-- Not during a live game; an open invite of theirs is called off.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if exists (select 1 from public.games g where g.status = 'playing' and (g.white_id = uid or g.black_id = uid)) then
    raise exception 'live_game' using errcode = 'P0001';
  end if;
  update public.games set status = 'aborted', result = '*', reason = 'abort', updated_at = now()
   where status = 'waiting' and host_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
