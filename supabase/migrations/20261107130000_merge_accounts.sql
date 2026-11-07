-- One person, one account: two accounts of the same person (say an Apple ID with a hidden email on the phone and
-- email + Google on the computer) become one. The play function calls this only after it has checked a fresh access
-- token of each account (the player signed in to both just now: one is the session, the other the sign-in method
-- they connected), so it is never callable by players directly.
--  * kept: the account with more finished games (on a tie, the older one); the other one goes;
--  * games, the better-played rating of each pool, admin rights move to the kept account; its name stays unless only
--    the other one's name was picked by the player;
--  * the sign-in methods (Apple, Google, ...) move over; an email login moves over only if the kept account has no
--    real address of its own (none, or an Apple relay address), else the other address goes with its account;
--  * not while either account is in a live game.
create or replace function public.gc_merge_accounts(p_a uuid, p_b uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  keep uuid; gone uuid;
  ga int; gb int;
  keep_email text; gone_email text;
  gone_name text; gone_chosen boolean; keep_chosen boolean;
  take_email boolean;
begin
  if p_a is null or p_b is null or p_a = p_b then
    raise exception 'same_account' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(424242);
  if not exists (select 1 from auth.users where id = p_a) or not exists (select 1 from auth.users where id = p_b) then
    raise exception 'no_account' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.games g where g.status = 'playing' and (g.white_id in (p_a, p_b) or g.black_id in (p_a, p_b))) then
    raise exception 'live_game' using errcode = 'P0001';
  end if;
  select count(*) into ga from public.games g where g.status = 'over' and (g.white_id = p_a or g.black_id = p_a);
  select count(*) into gb from public.games g where g.status = 'over' and (g.white_id = p_b or g.black_id = p_b);
  if ga > gb or (ga = gb and (select created_at from auth.users where id = p_a) <= (select created_at from auth.users where id = p_b)) then
    keep := p_a; gone := p_b;
  else
    keep := p_b; gone := p_a;
  end if;
  select email into keep_email from auth.users where id = keep;
  select email into gone_email from auth.users where id = gone;
  take_email := gone_email is not null and gone_email !~* 'privaterelay\.appleid\.com$'
    and (keep_email is null or keep_email ~* 'privaterelay\.appleid\.com$');

  -- the games, both sides and invites
  update public.games set white_id = keep where white_id = gone;
  update public.games set black_id = keep where black_id = gone;
  update public.games set host_id = keep where host_id = gone;
  -- each pool: the rating that has more games behind it
  delete from public.ratings k using public.ratings g
    where k.user_id = keep and g.user_id = gone and g.pool = k.pool and g.games > k.games;
  update public.ratings g set user_id = keep
    where g.user_id = gone and not exists (select 1 from public.ratings k where k.user_id = keep and k.pool = g.pool);
  insert into public.admins (user_id) select keep where exists (select 1 from public.admins where user_id = gone) on conflict do nothing;
  select username, name_chosen into gone_name, gone_chosen from public.profiles where id = gone;
  select name_chosen into keep_chosen from public.profiles where id = keep;

  -- the sign-in methods
  update auth.identities set user_id = keep where user_id = gone and provider <> 'email';
  if take_email then
    delete from auth.identities where user_id = keep and provider = 'email';
    update auth.identities set user_id = keep, provider_id = keep::text,
        identity_data = identity_data || jsonb_build_object('sub', keep::text)
      where user_id = gone and provider = 'email';
  end if;

  delete from auth.users where id = gone; -- the rest of it (profile, its own rating rows, seek) goes with it

  if take_email then
    update auth.users set email = gone_email, email_confirmed_at = coalesce(email_confirmed_at, now()) where id = keep;
  end if;
  update auth.users u set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('providers', (select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb) from auth.identities i where i.user_id = keep))
    where u.id = keep;
  if coalesce(gone_chosen, false) and not coalesce(keep_chosen, false) and gone_name is not null
     and not exists (select 1 from public.profiles where lower(username) = lower(gone_name)) then
    update public.profiles set username = gone_name, name_chosen = true where id = keep;
  end if;
  return jsonb_build_object('keep', keep, 'gone', gone);
end
$$;
revoke all on function public.gc_merge_accounts(uuid, uuid) from public, anon, authenticated;
