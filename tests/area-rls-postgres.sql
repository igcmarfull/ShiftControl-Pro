\set ON_ERROR_STOP on
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
create function test_access(p_user uuid,p_own text,p_expected int) returns void language plpgsql as $$
declare n int;
begin
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 execute 'set local role authenticated';
 select count(*) into n from area_state;
 if n<>p_expected then raise exception 'RLS count mismatch: expected %, got %',p_expected,n; end if;
 if p_own is not null then
   select count(*) into n from area_state where area=p_own;
   if n<>1 then raise exception 'Missing own area %',p_own; end if;
 end if;
 execute 'reset role';
end $$;
begin;
select test_access('11111111-1111-1111-1111-111111111111','ESTACION',1);
select test_access('22222222-2222-2222-2222-222222222222','TIENDA',1);
select test_access('33333333-3333-3333-3333-333333333333',null,2);
select test_access('44444444-4444-4444-4444-444444444444',null,0);
rollback;
\echo RLS integration checks passed
