-- DEPLOYMENT GATE: aplicar junto con la nueva Edge Function assign-chief.
-- Requiere 202610120001_membership_areas_prepare.sql.
-- IMPORTANTE: no habilita acceso CHIEF a app_state; antes de activar
-- jefaturas por área, implementar almacenamiento segregado y RLS por área.
begin;

-- Fase preparatoria: conservar la restricción legacy de una sola jefatura.
-- NO eliminar company_memberships_one_active_chief en esta migración:
-- assign_chief continúa en producción hasta el corte controlado.
-- El índice por área se crea ahora, pero la restricción legacy seguirá
-- impidiendo activar una segunda jefatura hasta una migración de cutover.
create unique index if not exists company_memberships_one_active_chief_per_area
  on public.company_memberships (company_id, area)
  nulls not distinct
  where role = 'CHIEF' and active = true;

-- RPC distinta para no alterar la firma legacy durante la preparación.
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
begin
  if p_area not in ('ESTACION', 'TIENDA') or p_area is null then
    raise exception 'Área inválida.';
  end if;

  if not exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = p_actor_user_id
      and m.role = 'ADMIN' and m.active = true
  ) then
    raise exception 'Solo un ADMIN activo puede asignar jefaturas.';
  end if;

  -- Evitar asignar a alguien que pertenece a otra empresa o es ADMIN.
  if exists (
    select 1 from public.company_memberships m
    where m.user_id = p_target_user_id
      and (m.company_id <> p_company_id or m.role = 'ADMIN')
  ) then
    raise exception 'La cuenta destino no puede ser asignada.';
  end if;

  -- Evitar carreras entre dos asignaciones de la misma empresa.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_company_id::text, 0)
  );

  select m.user_id into v_previous_user_id
  from public.company_memberships m
  where m.company_id = p_company_id
    and m.role = 'CHIEF' and m.active = true
    and m.area = p_area
  for update;

  if v_previous_user_id = p_target_user_id then
    raise exception 'Esa persona ya es la jefatura activa del área.';
  end if;

  -- Una persona no puede dirigir simultáneamente ambas áreas.
  if exists (
    select 1 from public.company_memberships m
    where m.user_id = p_target_user_id
      and m.role = 'CHIEF' and m.active = true
      and m.area is distinct from p_area
  ) then
    raise exception 'La cuenta ya tiene una jefatura activa en otra área.';
  end if;

  if v_previous_user_id is not null then
    update public.company_memberships m
    set active = false
    where m.company_id = p_company_id and m.user_id = v_previous_user_id;
    v_action := 'replaced';
  else
    v_action := 'assigned';
  end if;

  insert into public.company_memberships (company_id, user_id, role, area, active)
  values (p_company_id, p_target_user_id, 'CHIEF', p_area, true)
  on conflict (company_id, user_id)
  do update set role = 'CHIEF', area = excluded.area, active = true;

  insert into public.team_role_events (
    company_id, role, action, actor_user_id, target_user_id, previous_user_id
  ) values (
    p_company_id, 'CHIEF_' || p_area, v_action,
    p_actor_user_id, p_target_user_id, v_previous_user_id
  );

  return query select v_action, v_previous_user_id;
end;
$$;

revoke all on function public.assign_chief_area(uuid,uuid,uuid,text)
  from public, anon, authenticated;
commit;
