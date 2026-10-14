-- Preparación no disruptiva para Estación / Tienda.
-- No habilita por sí sola permisos de acceso por área.
-- Aplicar primero en un entorno de pruebas y verificar los datos existentes.

alter table public.company_memberships
  add column if not exists area text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_memberships_area_check'
      and conrelid = 'public.company_memberships'::regclass
  ) then
    alter table public.company_memberships
      add constraint company_memberships_area_check
      check (area is null or area in ('ESTACION', 'TIENDA'));
  end if;
end
$$;

-- La jefatura actual conserva area NULL hasta asignación manual.
-- NO retirar aún company_memberships_one_active_chief:
-- la Edge Function assign-chief sigue asumiendo una sola jefatura.
-- NO cambiar aún RLS de app_state: es un JSON completo por empresa
-- y requiere rediseñar la lectura/escritura antes de habilitar CHIEF por área.

create index if not exists company_memberships_company_area_idx
  on public.company_memberships (company_id, area)
  where active = true;
