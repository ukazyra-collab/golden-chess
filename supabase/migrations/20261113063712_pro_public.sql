-- Joker Pro: whether it is on sale, for anyone who asks (the website asks before a player has a session, to know
-- whether to show Pro at all). Only 'on' counts: while the owner's accounts try Pro out ('test') the public answer is
-- still no. Also how many Founder places are left. billing_config itself stays closed (it holds secrets).
create or replace function public.pro_public()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'on', coalesce((select c.value #>> '{}' from public.billing_config c where c.key = 'mode'), 'off') = 'on',
    'founders_left', greatest(0, 1000 - (select count(*) from public.profiles p where p.pro_founder))
  );
$$;
revoke all on function public.pro_public() from public;
grant execute on function public.pro_public() to anon, authenticated, service_role;
