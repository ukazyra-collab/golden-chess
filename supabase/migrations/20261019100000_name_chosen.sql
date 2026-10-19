-- Players pick their own name. Until they do, the name is a made-up one (SharpGambit43): the site asks for a name
-- after every sign-in, and from Profile. Set by the `rename` action of the play edge function.
alter table public.profiles add column if not exists name_chosen boolean not null default false;
