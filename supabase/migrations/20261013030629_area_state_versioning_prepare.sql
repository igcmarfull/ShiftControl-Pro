-- Versionado optimista del almacenamiento por área.
-- Requiere 202610120003_area_state_storage.sql.
-- La escritura usa RPC y rechaza versiones obsoletas en lugar de pisarlas.
begin;

alter table public.area_state
  add column if not exists revision bigint not null default 1;

create or replace function public.save_area_state(
  p_company_id uuid,
  p_area text,
  p_key text,
  p_data jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if p_area is null or p_area not in ('ESTACION', 'TIENDA')
    or p_key is null or length(trim(p_key)) = 0
    or p_data is null
  then
    raise exception 'Datos de área inválidos.';
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

revoke all on function public.save_area_state(uuid,text,text,jsonb,bigint) from public, anon;
grant execute on function public.save_area_state(uuid,text,text,jsonb,bigint) to authenticated;
commit;
