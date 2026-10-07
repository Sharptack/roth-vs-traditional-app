-- Audit-log self-check. Paste into the Supabase SQL editor and run AFTER
-- 20261007000000_household_audit.sql. Everything happens inside one transaction that is rolled back
-- at the end, so nothing is left behind (no households, no audit events). It stops with
-- "AUDIT FAIL: ..." if any rule is broken, and ends with "Audit checks passed" when they all hold.

begin;

insert into auth.users (id, email)
values ('00000000-0000-4000-8000-0000000000a1', 'audit-check-a@example.test'),
       ('00000000-0000-4000-8000-0000000000b1', 'audit-check-b@example.test');

-- As advisor A: create, rename, change the contents, open, then (below) delete.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

insert into public.saved_households (id, label, data)
values ('00000000-0000-4000-8000-0000000000c1', 'Audit A', '{"fields":{}}');
update public.saved_households set label = 'Audit A2' where id = '00000000-0000-4000-8000-0000000000c1';
update public.saved_households set data = '{"fields":{"grossIncome":"1"}}' where id = '00000000-0000-4000-8000-0000000000c1';

do $$ begin
  if (select count(*) from public.open_saved_household('00000000-0000-4000-8000-0000000000c1')) <> 1 then
    raise exception 'AUDIT FAIL: advisor A could not open their own household';
  end if;
  if (select data from public.open_saved_household('00000000-0000-4000-8000-0000000000c1'))
     <> '{"fields":{"grossIncome":"1"}}'::jsonb then
    raise exception 'AUDIT FAIL: opening did not return the saved contents';
  end if;
end $$;

-- The list still works (every column but the contents).
do $$ begin
  if (select count(*) from (select id, label, updated_at from public.saved_households) s) <> 1 then
    raise exception 'AUDIT FAIL: advisor A can no longer list their households';
  end if;
end $$;

-- The contents can't be read directly, even by the owner.
do $$ begin
  begin
    perform data from public.saved_households;
    raise exception 'AUDIT FAIL: the contents can be read without being logged';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Advisors can't read (or touch) the audit log.
do $$ begin
  begin
    perform 1 from audit.household_events;
    raise exception 'AUDIT FAIL: an advisor can read the audit log';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from audit.household_events;
    raise exception 'AUDIT FAIL: an advisor can delete from the audit log';
  exception when insufficient_privilege then null;
  end;
end $$;

-- As advisor B: opening A's household returns nothing (and logs nothing).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.open_saved_household('00000000-0000-4000-8000-0000000000c1')) <> 0 then
    raise exception 'AUDIT FAIL: advisor B opened advisor A''s household';
  end if;
end $$;

-- Signed out (the public anon key): can't open anything.
set local role anon;
do $$ begin
  begin
    perform 1 from public.open_saved_household('00000000-0000-4000-8000-0000000000c1');
    raise exception 'AUDIT FAIL: the anon key can call open_saved_household';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Back as A: delete it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
delete from public.saved_households where id = '00000000-0000-4000-8000-0000000000c1';

-- As the database owner: the log holds exactly what happened, in order, all by advisor A.
reset role;
do $$
declare
  got text;
begin
  select string_agg(action || ':' || coalesce(label_changed::text, '-') || ':' || coalesce(data_changed::text, '-'), ' ' order by id)
    into got
    from audit.household_events
   where household_id = '00000000-0000-4000-8000-0000000000c1';
  if got is distinct from 'create:-:- change:true:false change:false:true open:-:- open:-:- delete:-:-' then
    raise exception 'AUDIT FAIL: unexpected events: %', got;
  end if;
  if exists (select 1 from audit.household_events
              where household_id = '00000000-0000-4000-8000-0000000000c1'
                and actor_id is distinct from '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'AUDIT FAIL: an event is not credited to advisor A';
  end if;
  if (select label from audit.household_events
       where household_id = '00000000-0000-4000-8000-0000000000c1' and action = 'delete') <> 'Audit A2' then
    raise exception 'AUDIT FAIL: the delete event lost the label';
  end if;
end $$;

select 'Audit checks passed' as result;

rollback;
