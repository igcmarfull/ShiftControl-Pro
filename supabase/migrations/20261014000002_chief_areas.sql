-- Jefaturas por área: una Jefa de Isla y una Jefa de Tienda por empresa.
--
-- Requiere 20260804000001_team_management.sql y
-- 20261014000001_fix_memberships_admin_policy.sql.
--
-- - company_memberships.area identifica el área de cada jefatura
--   ('ISLA' o 'TIENDA'). Los administradores quedan sin área.
-- - Las jefaturas existentes se consideran de isla.
-- - La restricción de una jefatura activa pasa de "por empresa" a
--   "por empresa y área".
-- - assign_chief_area reemplaza a la jefatura de un área de forma atómica.
--   assign_chief (firma anterior) sigue funcionando y asigna la de isla.

begin;

alter table public.company_memberships
add column if not exists area text;

alter table public.company_memberships
drop constraint if exists company_memberships_area_check;

alter table public.company_memberships
add constraint company_memberships_area_check
check (area is null or area in ('ISLA', 'TIENDA'));

update public.company_memberships
set area = 'ISLA'
where role = 'CHIEF'
  and area is null;

alter table public.team_role_events
add column if not exists area text;

update public.team_role_events
set area = 'ISLA'
where area is null;

drop index if exists public.company_memberships_one_active_chief;

create unique index if not exists company_memberships_one_active_chief_per_area
on public.company_memberships (company_id, (coalesce(area, 'ISLA')))
where role = 'CHIEF' and active = true;

create or replace function public.assign_chief_area(
  p_company_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_area text
)
returns table (action text, previous_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_user_id uuid;
  v_action text;
  v_area_label text;
begin
  if p_area is null or p_area not in ('ISLA', 'TIENDA') then
    raise exception 'Área inválida.';
  end if;

  v_area_label := case p_area when 'TIENDA' then 'Tienda' else 'Isla' end;

  -- Evita que dos asignaciones simultáneas de la misma empresa se crucen.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 0)
  );

  if not exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = p_actor_user_id
      and membership.role = 'ADMIN'
      and membership.active = true
  ) then
    raise exception 'Solo un administrador activo puede asignar jefaturas.';
  end if;

  if exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = p_target_user_id
      and membership.role = 'ADMIN'
  ) then
    raise exception 'Una cuenta de administrador no puede asignarse como jefa.';
  end if;

  if exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = p_target_user_id
      and membership.role = 'CHIEF'
      and membership.active = true
      and coalesce(membership.area, 'ISLA') <> p_area
  ) then
    raise exception 'Esa persona ya es jefa de otra área.';
  end if;

  select membership.user_id
  into v_previous_user_id
  from public.company_memberships membership
  where membership.company_id = p_company_id
    and membership.role = 'CHIEF'
    and membership.active = true
    and coalesce(membership.area, 'ISLA') = p_area;

  if v_previous_user_id is not null and v_previous_user_id = p_target_user_id then
    raise exception 'Esa persona ya es la Jefa de % activa.', v_area_label;
  end if;

  if v_previous_user_id is not null then
    update public.company_memberships
    set active = false
    where company_id = p_company_id
      and user_id = v_previous_user_id;
    v_action := 'replaced';
  else
    v_action := 'assigned';
  end if;

  insert into public.company_memberships (company_id, user_id, role, area, active)
  values (p_company_id, p_target_user_id, 'CHIEF', p_area, true)
  on conflict (company_id, user_id)
  do update set role = 'CHIEF', area = p_area, active = true;

  insert into public.team_role_events (
    company_id, role, area, action, actor_user_id, target_user_id, previous_user_id
  )
  values (
    p_company_id, 'CHIEF', p_area, v_action, p_actor_user_id, p_target_user_id, v_previous_user_id
  );

  return query select v_action, v_previous_user_id;
end;
$$;

revoke all on function public.assign_chief_area(uuid, uuid, uuid, text)
from public, anon, authenticated;

create or replace function public.assign_chief(
  p_company_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid
)
returns table (action text, previous_user_id uuid)
language sql
security definer
set search_path = ''
as $$
  select result.action, result.previous_user_id
  from public.assign_chief_area(
    p_company_id,
    p_target_user_id,
    p_actor_user_id,
    'ISLA'
  ) result;
$$;

revoke all on function public.assign_chief(uuid, uuid, uuid)
from public, anon, authenticated;

commit;
