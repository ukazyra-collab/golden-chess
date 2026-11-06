-- Avatars: a player's own picture, kept in the public storage bucket `avatars` as <user id>.jpg (a 256×256 JPEG made on
-- the device), shown wherever the name is. profiles.avatar_v says there is one and which version (the picture's
-- address carries it, so a new picture is not hidden by a cached old one). A player may write only their own file.
alter table public.profiles add column if not exists avatar_v integer not null default 0;
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    return; -- the test database has no storage
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 524288, array['image/jpeg']) on conflict (id) do nothing;
  execute 'drop policy if exists "avatars are public" on storage.objects';
  execute 'create policy "avatars are public" on storage.objects for select using (bucket_id = ''avatars'')';
  execute 'drop policy if exists "own avatar in" on storage.objects';
  execute 'create policy "own avatar in" on storage.objects for insert to authenticated with check (bucket_id = ''avatars'' and name = auth.uid()::text || ''.jpg'')';
  execute 'drop policy if exists "own avatar update" on storage.objects';
  execute 'create policy "own avatar update" on storage.objects for update to authenticated using (bucket_id = ''avatars'' and name = auth.uid()::text || ''.jpg'')';
  execute 'drop policy if exists "own avatar out" on storage.objects';
  execute 'create policy "own avatar out" on storage.objects for delete to authenticated using (bucket_id = ''avatars'' and name = auth.uid()::text || ''.jpg'')';
end $$;
