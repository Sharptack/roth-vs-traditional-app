-- Saved client households for signed-in advisors (the #/next preview's "Saved households").
--
-- Security model: Postgres row-level security decides who sees what, not the app. Every row has
-- an owner (the advisor's auth user id), set by the database from the session on insert and
-- frozen afterwards; an advisor can read, change and delete only their own rows. The anon role
-- (the public key shipped in the browser) has no access at all. Run this once in the Supabase
-- SQL editor (or `supabase db push`); see docs/backend-setup.md.

create table if not exists public.saved_households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- A short name for the household. During testing: initials or a nickname, not a client's name.
  label text not null check (char_length(btrim(label)) between 1 and 80),
  -- The household form's values (src/lib/savedHousehold.js). Size-capped here as well as in the app.
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
  schema_version integer not null default 1 check (schema_version between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_households_owner_updated_idx
  on public.saved_households (owner_id, updated_at desc);

-- Row-level security: on, and enforced even for the table owner.
alter table public.saved_households enable row level security;
alter table public.saved_households force row level security;

-- Only signed-in users get table privileges at all; the anon (public) key gets none.
revoke all on table public.saved_households from anon, public;
grant select, insert, update, delete on table public.saved_households to authenticated;

drop policy if exists "advisors read their own households" on public.saved_households;
create policy "advisors read their own households" on public.saved_households
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "advisors add households as themselves" on public.saved_households;
create policy "advisors add households as themselves" on public.saved_households
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "advisors change their own households" on public.saved_households;
create policy "advisors change their own households" on public.saved_households
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "advisors delete their own households" on public.saved_households;
create policy "advisors delete their own households" on public.saved_households
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- On every update: stamp updated_at, and keep the owner and creation time as they were, whatever
-- the client sent (an advisor can't hand a row to someone else).
create or replace function public.saved_households_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_households_before_update on public.saved_households;
create trigger saved_households_before_update
  before update on public.saved_households
  for each row execute function public.saved_households_before_update();
