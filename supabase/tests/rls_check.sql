-- Row-level security self-check for public.saved_households. Paste into the Supabase SQL editor
-- and run AFTER the migration. Everything happens inside one transaction that is rolled back at
-- the end, so nothing is left behind. It stops with "RLS FAIL: ..." if any rule is broken, and
-- ends with "RLS checks passed" when they all hold.

begin;

-- Two throwaway advisors (rolled back at the end).
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-00000000000a', 'rls-check-a@example.test'),
       ('00000000-0000-4000-8000-00000000000b', 'rls-check-b@example.test');

-- As advisor A: save a household (the owner comes from the session).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.saved_households (label, data) values ('A only', '{"fields":{}}');

do $$ begin
  if (select owner_id from public.saved_households where label = 'A only')
     <> '00000000-0000-4000-8000-00000000000a' then
    raise exception 'RLS FAIL: the owner was not set from the session';
  end if;
end $$;

-- As advisor B: A's household is invisible, can't be changed, deleted or forged.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$ begin
  if (select count(*) from public.saved_households) <> 0 then
    raise exception 'RLS FAIL: advisor B can see advisor A''s household';
  end if;
end $$;

update public.saved_households set label = 'changed by B';   -- must touch 0 rows
delete from public.saved_households;                         -- must touch 0 rows

do $$ begin
  begin
    insert into public.saved_households (owner_id, label, data)
    values ('00000000-0000-4000-8000-00000000000a', 'forged by B', '{"fields":{}}');
    raise exception 'RLS FAIL: advisor B saved a household as advisor A';
  exception when insufficient_privilege then null;  -- expected: blocked by the policy
  end;
end $$;

-- Signed out (the public anon key): no access to the table at all.
set local role anon;
do $$ begin
  begin
    perform 1 from public.saved_households;
    raise exception 'RLS FAIL: the anon key can read saved households';
  exception when insufficient_privilege then null;  -- expected: no privilege
  end;
end $$;

-- Back as A: the household is intact, and A can't hand it to B.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
update public.saved_households set owner_id = '00000000-0000-4000-8000-00000000000b' where label = 'A only';

do $$ begin
  if (select count(*) from public.saved_households where label = 'A only') <> 1 then
    raise exception 'RLS FAIL: advisor B changed or deleted advisor A''s household';
  end if;
  if (select owner_id from public.saved_households where label = 'A only')
     <> '00000000-0000-4000-8000-00000000000a' then
    raise exception 'RLS FAIL: a household was handed to another advisor';
  end if;
end $$;

select 'RLS checks passed' as result;

rollback;
