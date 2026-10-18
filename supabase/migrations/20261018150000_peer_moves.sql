-- Players may broadcast their own moves to each other on a separate topic, "m:<game id>", so the opponent
-- sees a move without waiting for the server round trip. These messages are only display hints: clients trust
-- nothing but the server's game state on "g:<game id>", which no client can send to.
do $$
begin
  execute 'drop policy if exists "golden chess players send moves" on realtime.messages';
  execute $p$
    create policy "golden chess players send moves" on realtime.messages for insert to authenticated
    with check (
      realtime.messages.extension = 'broadcast'
      and (select realtime.topic()) like 'm:%'
      and exists (
        select 1 from public.games g
        where g.id::text = substr((select realtime.topic()), 3)
          and (g.white_id = (select auth.uid()) or g.black_id = (select auth.uid()))
      )
    )
  $p$;
exception when others then
  raise notice 'peer move policy skipped: %', sqlerrm;
end
$$;
