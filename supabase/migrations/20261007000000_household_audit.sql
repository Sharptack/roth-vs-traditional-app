-- Audit log for saved households: who created, opened, changed and deleted each one, and when.
--
-- Run once in the Supabase SQL editor AFTER 20261005000000_saved_households.sql (see
-- docs/backend-setup.md), then check it with supabase/tests/audit_check.sql.
--
-- How it works:
-- - audit.household_events is append-only from the app's point of view: no advisor and not the
--   public key can read, change or delete it. It lives in its own schema, which the Data API does
--   not expose. Read it in the SQL editor:
--     select * from audit.household_events order by at desc;
-- - Database triggers log every create, change and delete, whatever the app does.
-- - Reads can't fire triggers, so a household's contents (the `data` column) can no longer be read
--   directly: advisors may read every OTHER column (the list of households), and the contents only
--   through public.open_saved_household(id), which checks the household is theirs and logs the open
--   in the same step. A household can't be opened without leaving a record.
-- - Events keep the household's id, owner and label but no contents, and no link to the table, so
--   the history outlives a deleted household.

create schema if not exists audit;
revoke all on schema audit from public, anon, authenticated;

create table if not exists audit.household_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (action in ('create', 'open', 'change', 'delete')),
  household_id uuid not null,
  owner_id uuid,
  -- The advisor who did it (null when the database did it, e.g. a deleted user's households).
  actor_id uuid,
  label text,
  -- For 'change': which parts changed.
  label_changed boolean,
  data_changed boolean
);

create index if not exists household_events_household_idx on audit.household_events (household_id, at desc);
create index if not exists household_events_actor_idx on audit.household_events (actor_id, at desc);

-- Locked: row-level security on with no policies, and no privileges for the API roles. Only the
-- functions below (owned by the role running this script) write to it.
alter table audit.household_events enable row level security;
revoke all on table audit.household_events from public, anon, authenticated;

-- Create, change and delete, from triggers.
create or replace function audit.log_household_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into audit.household_events (action, household_id, owner_id, actor_id, label)
    values ('create', new.id, new.owner_id, auth.uid(), new.label);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit.household_events (action, household_id, owner_id, actor_id, label, label_changed, data_changed)
    values ('change', new.id, new.owner_id, auth.uid(), new.label,
            old.label is distinct from new.label, old.data is distinct from new.data);
    return new;
  else
    insert into audit.household_events (action, household_id, owner_id, actor_id, label)
    values ('delete', old.id, old.owner_id, auth.uid(), old.label);
    return old;
  end if;
end;
$$;

revoke all on function audit.log_household_write() from public, anon, authenticated;

drop trigger if exists saved_households_audit on public.saved_households;
create trigger saved_households_audit
  after insert or update or delete on public.saved_households
  for each row execute function audit.log_household_write();

-- The contents only through the logged function: advisors keep SELECT on every column but `data`.
-- (UPDATE and INSERT of `data` are unchanged: saving still works as before.)
revoke select on table public.saved_households from authenticated;
grant select (id, owner_id, label, schema_version, created_at, updated_at)
  on table public.saved_households to authenticated;

-- open_saved_household runs as the role running this script (security definer), and the table's
-- row-level security is FORCED, so it applies to that role too and the advisor policies above (to
-- authenticated) don't cover it. This policy lets that role read the CALLER's own rows only, so
-- ownership is still checked by row-level security, not just by the function's own filter. (It
-- does no harm where that role bypasses row-level security anyway.)
do $$ begin
  execute format('drop policy if exists "open function reads the caller''s households" on public.saved_households');
  execute format(
    'create policy "open function reads the caller''s households" on public.saved_households
       for select to %I using ((select auth.uid()) = owner_id)', current_user);
end $$;

-- Open one household: only the caller's own, and the open is logged. No row (not found, or not
-- theirs) = nothing returned and nothing logged.
create or replace function public.open_saved_household(target_id uuid)
returns setof public.saved_households
language plpgsql
security definer
set search_path = ''
as $$
declare
  household public.saved_households;
begin
  select h.* into household
    from public.saved_households h
   where h.id = target_id
     and h.owner_id = (select auth.uid());
  if not found then
    return;
  end if;
  insert into audit.household_events (action, household_id, owner_id, actor_id, label)
  values ('open', household.id, household.owner_id, (select auth.uid()), household.label);
  return next household;
end;
$$;

revoke all on function public.open_saved_household(uuid) from public, anon;
grant execute on function public.open_saved_household(uuid) to authenticated;
