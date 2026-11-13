-- Joker Pro bought in the apps: the App Store's and Google Play's purchases beside what Stripe sells on the website.
-- The pay function is the only writer. A profile's Pro (pro_until, pro_founder, pro_plan) is now worked out from
-- everything the account holds: gc_pro_refresh.

create table if not exists public.store_purchases (
  id text primary key,                     -- 'apple:<the subscription's first transaction>' | 'google:<the purchase token>'
  store text not null check (store in ('apple', 'google')),
  user_id uuid references public.profiles(id) on delete set null,   -- whose it is now (the last account that bought or restored it)
  kind text not null check (kind in ('sub', 'founder')),
  plan text check (plan is null or plan in ('month', 'year', 'founder')),
  product text not null,                   -- the store's product id
  tx text,                                 -- Apple: the newest transaction; Google: the newest order
  token text,                              -- Google: the purchase token (the store is asked about it again as it runs)
  status text not null default 'active',   -- 'active' | 'grace' | 'expired' | 'revoked' | 'paused' | 'pending'
  expires_at timestamptz,                  -- a subscription: when Pro from it ends
  auto_renew boolean,                      -- false: cancelled, runs to the end of what is paid
  trial boolean not null default false,
  sandbox boolean not null default false,  -- a tester's or a reviewer's purchase: no money moved
  revoked_at timestamptz,                  -- refunded or taken back
  signed_at timestamptz,                   -- Apple: when the newest data held was signed
  checked_at timestamptz,                  -- Google: when the store was last asked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists store_purchases_user on public.store_purchases (user_id);
create index if not exists store_purchases_google on public.store_purchases (expires_at) where store = 'google' and kind = 'sub';
alter table public.store_purchases enable row level security;
revoke all on public.store_purchases from anon, authenticated;
grant all on public.store_purchases to service_role;

-- Stripe's side keeps when its Pro ends (a running period or trial: its end; a failed renewal: a few days of grace;
-- anything else: it has ended), so that it can be weighed against what the stores say
alter table public.billing add column if not exists until timestamptz;
update public.billing b set until = p.pro_until from public.profiles p where p.id = b.user_id and b.until is null and b.subscription is not null;

-- which stores sell in the apps: {"ios": "off" | "test" | "on", "android": ...} ('test': the owner's accounts only)
insert into public.billing_config (key, value) values ('stores', '{"ios": "off", "android": "off"}'::jsonb) on conflict (key) do nothing;
-- the hourly look at Google's subscriptions calls the pay function with this key
insert into public.billing_config (key, value) values ('cron_key', to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))) on conflict (key) do nothing;

-- the hourly look at Google's subscriptions (renewed? cancelled? on hold?): pg_cron calls the pay function at :17 through
-- pg_net with the cron's key (a database without them, such as the tests' PGlite, skips this). Apple needs no such
-- look: it sends its own notifications. Without a Google key in the function the look does nothing.
do $do$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.schedule('pay-sweep', '17 * * * *',
      $job$select net.http_post(url := 'https://wduoqpoqbtpkrgbcsegg.supabase.co/functions/v1/pay',
        body := jsonb_build_object('action', 'sweep', 'key', (select value #>> '{}' from public.billing_config where key = 'cron_key')), timeout_milliseconds := 60000)$job$);
  end if;
end $do$;

-- a profile's Pro from everything its account holds: Stripe (billing) and the stores (store_purchases).
-- Until: the latest end among them. Founder: paid for life anywhere. Plan: founder; else the plan of whichever lasts
-- longer (a store's subscription, or Stripe's while it runs); else the last one bought stays.
create or replace function public.gc_pro_refresh(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b_until timestamptz; b_plan text; b_founder boolean; b_live boolean;
  s_until timestamptz; s_plan text; s_founder boolean;
  f boolean;
begin
  select b.until, b.plan, b.founder_at is not null, coalesce(b.status in ('trialing', 'active', 'past_due'), false)
    into b_until, b_plan, b_founder, b_live
    from public.billing b where b.user_id = p_user;
  select s.expires_at, s.plan into s_until, s_plan
    from public.store_purchases s
    where s.user_id = p_user and s.kind = 'sub' and s.expires_at is not null
    order by s.expires_at desc limit 1;
  s_founder := exists (select 1 from public.store_purchases s where s.user_id = p_user and s.kind = 'founder' and s.revoked_at is null and s.status = 'active');
  f := coalesce(b_founder, false) or s_founder;
  update public.profiles p set
      pro_founder = f,
      pro_until = greatest(b_until, s_until),
      pro_plan = case when f then 'founder'
                      when s_until is not null and (b_until is null or s_until > b_until) then coalesce(s_plan, p.pro_plan)
                      when b_live then coalesce(b_plan, p.pro_plan)
                      when p.pro_plan = 'founder' then null
                      else p.pro_plan end
    where p.id = p_user;
end
$$;
revoke all on function public.gc_pro_refresh(uuid) from public, anon, authenticated;
grant execute on function public.gc_pro_refresh(uuid) to service_role;

-- two accounts of one person become one: what was bought in the apps moves with the rest
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
  bill public.billing;
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

  -- Joker Pro: what the other account paid for moves to the kept one. Two running subscriptions can't become one:
  -- that merge is refused until one of them is cancelled.
  select * into bill from public.billing where user_id = gone;
  if found then
    if bill.status in ('trialing', 'active', 'past_due')
       and exists (select 1 from public.billing k where k.user_id = keep and k.status in ('trialing', 'active', 'past_due')) then
      raise exception 'two_subscriptions' using errcode = 'P0001';
    end if;
    update public.billing set customer = null where user_id = gone; -- (a customer belongs to one account)
    insert into public.billing (user_id) values (keep) on conflict (user_id) do nothing;
    if bill.status in ('trialing', 'active', 'past_due') then
      update public.billing set customer = bill.customer, subscription = bill.subscription, status = bill.status, plan = bill.plan, period_end = bill.period_end,
          until = bill.until, cancel_at_period_end = bill.cancel_at_period_end, livemode = bill.livemode, updated_at = now()
        where user_id = keep;
    else
      update public.billing set livemode = case when customer is null then bill.livemode else livemode end, customer = coalesce(customer, bill.customer), updated_at = now()
        where user_id = keep;
    end if;
    update public.billing set trial_used = trial_used or bill.trial_used, founder_at = coalesce(founder_at, bill.founder_at),
        founder_payment = coalesce(founder_payment, bill.founder_payment)
      where user_id = keep;
    update public.profiles k set
        pro_plan = case when k.pro_founder or g.pro_founder then 'founder'
                        when coalesce(g.pro_until, '-infinity') > coalesce(k.pro_until, '-infinity') then g.pro_plan else k.pro_plan end,
        pro_until = nullif(greatest(coalesce(k.pro_until, '-infinity'), coalesce(g.pro_until, '-infinity')), '-infinity'),
        pro_founder = k.pro_founder or g.pro_founder
      from public.profiles g where k.id = keep and g.id = gone;
  end if;

  -- what was bought in the apps (App Store, Google Play) moves with it
  update public.store_purchases set user_id = keep, updated_at = now() where user_id = gone;
  if exists (select 1 from public.store_purchases where user_id = keep) then
    perform public.gc_pro_refresh(keep);
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
grant execute on function public.gc_merge_accounts(uuid, uuid) to service_role;

-- is Pro on sale: also in which apps (only 'on' counts for the public answer)
create or replace function public.pro_public()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'on', coalesce((select c.value #>> '{}' from public.billing_config c where c.key = 'mode'), 'off') = 'on',
    'ios', coalesce((select c.value ->> 'ios' from public.billing_config c where c.key = 'stores'), 'off') = 'on',
    'android', coalesce((select c.value ->> 'android' from public.billing_config c where c.key = 'stores'), 'off') = 'on',
    'founders_left', greatest(0, 1000 - (select count(*) from public.billing b where b.founder_at is not null)
      - (select count(*) from public.store_purchases s where s.kind = 'founder' and s.status = 'active' and s.revoked_at is null and not s.sandbox))
  );
$$;
revoke all on function public.pro_public() from public;
grant execute on function public.pro_public() to anon, authenticated, service_role;
