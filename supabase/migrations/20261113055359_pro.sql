-- Joker Pro, the paid tier: what an account has paid for, and the bookkeeping behind it (Stripe).
-- The pay function (supabase/functions/pay) is the only writer. Nothing here sells anything by itself: the tier is
-- shown to players only when billing_config's mode says so ('off' at first).

-- what everyone may see of a player: Pro is on until pro_until (a subscription's paid period or trial), or for life
alter table public.profiles add column if not exists pro_until timestamptz;
alter table public.profiles add column if not exists pro_plan text;                               -- the last one bought
alter table public.profiles add column if not exists pro_founder boolean not null default false;  -- paid once, for life
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_pro_plan_check') then
    alter table public.profiles add constraint profiles_pro_plan_check check (pro_plan is null or pro_plan in ('month', 'year', 'founder'));
  end if;
end $$;

-- what only the server sees: the Stripe side of an account
create table if not exists public.billing (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer text,                                   -- the Stripe customer
  subscription text,                               -- the current (or last) Stripe subscription
  status text,                                     -- Stripe's word for it: trialing, active, past_due, canceled, unpaid, incomplete, ...
  plan text check (plan is null or plan in ('month', 'year')),
  period_end timestamptz,                          -- what is paid (or on trial) until
  cancel_at_period_end boolean not null default false,
  trial_used boolean not null default false,       -- one free trial an account
  founder_at timestamptz,                          -- the one payment for life
  founder_payment text,
  livemode boolean not null default false,         -- real money, or Stripe's test mode
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create unique index if not exists billing_customer on public.billing (customer) where customer is not null;
alter table public.billing enable row level security;
grant all on public.billing to service_role;

-- every Stripe event once (a repeated delivery finds its row and stops there)
create table if not exists public.billing_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  user_id uuid,
  note text,
  created_at timestamptz not null default now());
alter table public.billing_events enable row level security;
grant all on public.billing_events to service_role;

-- settings, and what the pay function keeps between its runs: the mode ('off': nobody sees Pro; 'test': the owner's
-- accounts only; 'on': everyone), the webhook's signing secret, the ids of what it set up at Stripe
create table if not exists public.billing_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now());
alter table public.billing_config enable row level security;
grant all on public.billing_config to service_role;
insert into public.billing_config (key, value) values ('mode', '"off"'::jsonb) on conflict (key) do nothing;

-- a player with a subscription that is still running can't delete the account from under it (it would go on charging):
-- they cancel it first. A cancelled one that runs out by itself, and a founder's payment, don't hold the account.
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
  if exists (select 1 from public.billing b where b.user_id = uid and b.status in ('trialing', 'active', 'past_due') and not b.cancel_at_period_end) then
    raise exception 'active_subscription' using errcode = 'P0001';
  end if;
  update public.games set status = 'aborted', result = '*', reason = 'abort', updated_at = now()
   where status = 'waiting' and host_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- two accounts of one person become one (the merge_accounts migration), now with what they paid for
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
          cancel_at_period_end = bill.cancel_at_period_end, livemode = bill.livemode, updated_at = now()
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
