begin;
create schema if not exists shiftcontrol_backup;
revoke all on schema shiftcontrol_backup from public, anon, authenticated;
create table if not exists shiftcontrol_backup.snapshot_before_area_cutover as
select 'app_state'::text as source_table, a.company_id, null::text as area,
       a.key::text as record_key, to_jsonb(a) as original_record,
       now() as captured_at
from public.app_state a
union all
select 'area_state'::text, a.company_id, a.area, a.key, to_jsonb(a), now()
from public.area_state a
union all
select 'company_memberships'::text, m.company_id, m.area,
       m.user_id::text, to_jsonb(m), now()
from public.company_memberships m
union all
select 'team_role_events'::text, e.company_id, null::text,
       e.id::text, to_jsonb(e), now()
from public.team_role_events e;
revoke all on all tables in schema shiftcontrol_backup from public, anon, authenticated;
commit;
