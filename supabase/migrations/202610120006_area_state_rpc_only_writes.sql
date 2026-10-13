-- Endurece la escritura de area_state: toda mutación pasa por una RPC con
-- control de membresía y versión; las escrituras directas quedan bloqueadas.
-- Requiere 202610120003 y 202610120004. NO ejecutar antes del corte de cliente.
begin;

revoke insert, update, delete on public.area_state from anon, authenticated;

drop policy if exists area_state_insert_member on public.area_state;
drop policy if exists area_state_update_member on public.area_state;

create or replace function public.save_area_state(
  p_company_id uuid,
  p_area text,
  p_key text,
  p_data jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticación requerida.' using errcode = '42501';
  end if;

  if p_company_id is null or p_area is null
     or p_area not in ('ESTACION', 'TIENDA')
     or p_key is null or length(trim(p_key)) = 0
     or p_data is null
     or (p_expected_revision is not null and p_expected_revision < 1)
  then
    raise exception 'Datos de área inválidos.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (
        m.role = 'ADMIN'
        or (m.role = 'CHIEF' and m.area = p_area)
      )
  ) then
    raise exception 'Sin autorización para escribir en esta área.'
      using errcode = '42501';
  end if;

  if p_expected_revision is null then
    insert into public.area_state (company_id, area, key, data, revision, updated_at)
    values (p_company_id, p_area, p_key, p_data, 1, now())
    on conflict (company_id, area, key) do nothing
    returning revision into v_revision;
  else
    update public.area_state
    set data = p_data,
        revision = revision + 1,
        updated_at = now()
    where company_id = p_company_id
      and area = p_area
      and key = p_key
      and revision = p_expected_revision
    returning revision into v_revision;
  end if;

  if v_revision is null then
    raise exception 'Conflicto de sincronización: el estado cambió. Recarga antes de guardar.'
      using errcode = '40001';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.save_area_state(uuid,text,text,jsonb,bigint)
  from public, anon, authenticated;
grant execute on function public.save_area_state(uuid,text,text,jsonb,bigint)
  to authenticated;

commit;
