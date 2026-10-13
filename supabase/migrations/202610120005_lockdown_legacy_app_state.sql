-- SECURITY CUTOVER ONLY. DO NOT APPLY UNTIL ALL CLIENTS HAVE MIGRATED.
-- CHIEF currently uses public.app_state for the full company JSON.
-- Applying this prematurely will break existing CHIEF sessions.
-- Run AFTER the new per-area client has been deployed and validated.
begin;

drop policy if exists "app_state_select_for_active_members" on public.app_state;
drop policy if exists "app_state_insert_for_active_members" on public.app_state;
drop policy if exists "app_state_update_for_active_members" on public.app_state;

-- Fail closed: legacy company-wide state is ADMIN-only.
create policy app_state_admin_select
on public.app_state for select to authenticated
using (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = app_state.company_id
      and m.user_id = (select auth.uid())
      and m.role = 'ADMIN'
      and m.active = true
  )
);

create policy app_state_admin_insert
on public.app_state for insert to authenticated
with check (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = app_state.company_id
      and m.user_id = (select auth.uid())
      and m.role = 'ADMIN'
      and m.active = true
  )
);

create policy app_state_admin_update
on public.app_state for update to authenticated
using (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = app_state.company_id
      and m.user_id = (select auth.uid())
      and m.role = 'ADMIN'
      and m.active = true
  )
)
with check (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = app_state.company_id
      and m.user_id = (select auth.uid())
      and m.role = 'ADMIN'
      and m.active = true
  )
);

commit;
