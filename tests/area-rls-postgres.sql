\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table companies(id uuid primary key);
create table company_memberships(company_id uuid,user_id uuid,active boolean,role text,area text);
grant usage on schema public,auth to authenticated;
grant select on company_memberships to authenticated;
grant execute on function auth.uid() to authenticated;
insert into companies values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into company_memberships values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111',true,'CHIEF','ESTACION'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222',true,'CHIEF','TIENDA'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333',true,'ADMIN',null),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','44444444-4444-4444-4444-444444444444',false,'CHIEF','ESTACION');
\i supabase/migrations/202610120003_area_state_storage.sql
insert into area_state(company_id,area,key,data) values
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ESTACION','schedule','{}'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TIENDA','schedule','{}');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$ begin
 if (select count(*) from area_state) <> 1 or (select count(*) from area_state where area='ESTACION') <> 1 then
 raise exception 'Station read isolation failed'; end if;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$ begin
 if (select count(*) from area_state) <> 1 or (select count(*) from area_state where area='TIENDA') <> 1 then
 raise exception 'Store read isolation failed'; end if;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
do $$ begin
 if (select count(*) from area_state) <> 2 then raise exception 'Admin read failed'; end if;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
do $$ begin
 if (select count(*) from area_state) <> 0 then raise exception 'Inactive member access'; end if;
end $$;
rollback;
\echo RLS integration checks passed

-- Verify write isolation under the same authenticated roles.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$
declare affected integer;
begin
  update area_state set data='{"test":"own"}' where area='ESTACION';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Station cannot update own area'; end if;
  update area_state set data='{"test":"foreign"}' where area='TIENDA';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Station updated store area'; end if;
  begin
    insert into area_state(company_id,area,key,data) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TIENDA','cross-area','{}');
    raise exception 'Station inserted into store area';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$
declare affected integer;
begin
  update area_state set data='{"test":"own"}' where area='TIENDA';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Store cannot update own area'; end if;
  update area_state set data='{"test":"foreign"}' where area='ESTACION';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Store updated station area'; end if;
  begin
    insert into area_state(company_id,area,key,data) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ESTACION','cross-area','{}');
    raise exception 'Store inserted into station area';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
do $$
declare affected integer;
begin
  update area_state set data='{"test":"admin"}' where key='schedule';
  get diagnostics affected = row_count;
  if affected <> 2 then raise exception 'Admin cannot update both areas'; end if;
end $$;
rollback;
\echo Write isolation checks passed

-- An existing row must not be movable to another area via UPDATE.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
do $$
begin
  begin
    update area_state set area='TIENDA' where area='ESTACION' and key='schedule';
    raise exception 'Station moved its schedule to store';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
do $$
begin
  begin
    update area_state set area='ESTACION' where area='TIENDA' and key='schedule';
    raise exception 'Store moved its schedule to station';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
-- Inactive memberships must also be denied UPDATE and INSERT.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',true);
do $$
declare affected integer;
begin
  update area_state set data='{"tampered":true}' where area='ESTACION';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Inactive member updated a row'; end if;
  begin
    insert into area_state(company_id,area,key,data) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ESTACION','inactive-write','{}');
    raise exception 'Inactive member inserted a row';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo Area movement and inactive write checks passed
