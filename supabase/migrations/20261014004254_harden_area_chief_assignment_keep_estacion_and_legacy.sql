begin;
create or replace function public.assign_chief_area(
  p_company_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_area text
)
returns table (action text, previous_user_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare v_previous_user_id uuid; v_action text; v_area text;
begin
  v_area := case upper(trim(coalesce(p_area,'')))
    when 'ISLA' then 'ESTACION'
    when 'ESTACION' then 'ESTACION'
    when 'TIENDA' then 'TIENDA'
    else null end;
  if v_area is null or p_company_id is null or p_target_user_id is null or p_actor_user_id is null then
    raise exception 'Datos de asignación de jefatura inválidos.' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,0));
  if not exists (select 1 from public.company_memberships m
      where m.company_id=p_company_id and m.user_id=p_actor_user_id
      and m.role='ADMIN' and m.active=true) then
    raise exception 'Solo un administrador activo de la empresa puede asignar jefaturas.'
      using errcode='42501';
  end if;
  if p_actor_user_id=p_target_user_id or exists (
      select 1 from public.company_memberships m where m.user_id=p_target_user_id
      and (m.role='ADMIN' or m.company_id<>p_company_id)
  ) then
    raise exception 'La cuenta destino no puede ser asignada como jefatura.'
      using errcode='42501';
  end if;
  if exists (select 1 from public.company_memberships m where m.user_id=p_target_user_id
    and m.role='CHIEF' and m.active=true and m.area is distinct from v_area) then
    raise exception 'La cuenta ya ejerce una jefatura activa en otra área.';
  end if;
  select m.user_id into v_previous_user_id
    from public.company_memberships m
    where m.company_id=p_company_id and m.role='CHIEF'
      and m.active=true and m.area=v_area for update;
  if v_previous_user_id=p_target_user_id then
    raise exception 'Esa persona ya es la jefatura activa del área.';
  end if;
  if v_previous_user_id is not null then
    update public.company_memberships m set active=false
    where m.company_id=p_company_id and m.user_id=v_previous_user_id;
    v_action:='replaced';
  else v_action:='assigned';
  end if;
  insert into public.company_memberships(company_id,user_id,role,area,active)
  values(p_company_id,p_target_user_id,'CHIEF',v_area,true)
  on conflict(company_id,user_id)
  do update set role='CHIEF',area=excluded.area,active=true;
  insert into public.team_role_events(company_id,role,action,actor_user_id,target_user_id,previous_user_id)
  values(p_company_id,'CHIEF_'||v_area,v_action,p_actor_user_id,p_target_user_id,v_previous_user_id);
  return query select v_action,v_previous_user_id;
end;
$$;
revoke all on function public.assign_chief_area(uuid,uuid,uuid,text) from public,anon,authenticated;
create or replace function public.assign_chief(
  p_company_id uuid,p_target_user_id uuid,p_actor_user_id uuid
) returns table(action text,previous_user_id uuid)
language sql security definer set search_path = ''
as $$
select r.action,r.previous_user_id
from public.assign_chief_area(p_company_id,p_target_user_id,p_actor_user_id,'ESTACION') r;
$$;
revoke all on function public.assign_chief(uuid,uuid,uuid) from public,anon,authenticated;
commit;
