-- Quién puede recibir una entrega de turno: usuarios reales de la empresa.
--   * Una jefatura ve a los administradores y a las jefaturas de su misma área (nunca las del otro área).
--   * Un administrador ve a los demás administradores y a todas las jefaturas activas.
--   * Nadie se ve a sí mismo. Solo se listan usuarios con membresía y perfil activos.
-- Es una lectura: no crea tablas. Se necesita una función porque las jefaturas no pueden leer company_memberships
-- ni los perfiles de otros usuarios. area se devuelve normalizada ('ISLA' o 'TIENDA'; ESTACION y NULL = ISLA).

create or replace function public.handoff_recipients()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_role text;
  v_area text;
begin
  select m.company_id, m.role, case when m.area = 'TIENDA' then 'TIENDA' else 'ISLA' end
    into v_company, v_role, v_area
  from public.company_memberships m
  where m.user_id = auth.uid() and m.active and m.role in ('ADMIN', 'CHIEF')
  limit 1;
  if v_company is null then
    raise exception 'No tienes acceso a las entregas de turno.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', m.user_id,
             'name', p.display_name,
             'role', m.role,
             'area', case when m.area = 'TIENDA' then 'TIENDA' else 'ISLA' end
           ) order by m.role, p.display_name)
    from public.company_memberships m
    join public.profiles p on p.id = m.user_id and p.active
    where m.company_id = v_company
      and m.active
      and m.user_id <> auth.uid()
      and (m.role = 'ADMIN'
           or v_role = 'ADMIN'
           or (case when m.area = 'TIENDA' then 'TIENDA' else 'ISLA' end) = v_area)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.handoff_recipients() from public, anon;
grant execute on function public.handoff_recipients() to authenticated;
