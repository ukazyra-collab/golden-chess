-- Saving a name (the `rename` action: a name the player typed, or the made-up one kept) marks it as chosen.
-- A trigger, so the edge function needs no change.
create or replace function public.profiles_name_chosen() returns trigger language plpgsql set search_path = '' as $$
begin
  new.name_chosen := true;
  return new;
end $$;
create or replace trigger profiles_name_chosen before update of username on public.profiles
  for each row execute function public.profiles_name_chosen();
