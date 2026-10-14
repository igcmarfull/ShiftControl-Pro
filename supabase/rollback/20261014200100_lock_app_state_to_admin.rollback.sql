-- REVERSIÓN de 20261014200100_lock_app_state_to_admin.sql (fase 2).
--
-- NO es una migración: está fuera de supabase/migrations/ a propósito, para que
-- ninguna herramienta la aplique sola. Se ejecuta a mano, solo si la fase 2 se
-- aplicó y hay que devolver a las jefaturas el acceso directo a app_state.
--
-- Restaura exactamente las tres policies que existían antes de la fase 2
-- (definidas en 202607260002_app_state_tenancy.sql) y quita las de
-- administrador. Todo ocurre en una transacción: si algo falla, no cambia nada.
-- No toca datos, funciones ni membresías.
--
-- Después de revertir:
-- - La app publicada sigue funcionando: usa las funciones por área y, si no
--   estuvieran, vuelve al acceso directo.
-- - Cualquier miembro activo vuelve a poder leer y escribir app_state completo
--   (el estado anterior, con el límite descrito en docs/auditoria-2026-10-14.md).
--   Mientras esté revertida, mantener inactiva a la Jefa de Tienda.

begin;

drop policy if exists "app_state_select_for_admins" on public.app_state;
drop policy if exists "app_state_insert_for_admins" on public.app_state;
drop policy if exists "app_state_update_for_admins" on public.app_state;
drop policy if exists "app_state_select_for_active_members" on public.app_state;
drop policy if exists "app_state_insert_for_active_members" on public.app_state;
drop policy if exists "app_state_update_for_active_members" on public.app_state;

create policy "app_state_select_for_active_members"
on public.app_state
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);

create policy "app_state_insert_for_active_members"
on public.app_state
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);

create policy "app_state_update_for_active_members"
on public.app_state
for update
to authenticated
using (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
)
with check (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = app_state.company_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  )
);

-- Comprobación: deben quedar exactamente las tres policies de miembros.
do $$
declare names text;
begin
  select string_agg(policyname, ', ' order by policyname) into names
  from pg_policies where schemaname = 'public' and tablename = 'app_state';
  if names is distinct from
     'app_state_insert_for_active_members, app_state_select_for_active_members, app_state_update_for_active_members' then
    raise exception 'Reversión incompleta; policies actuales: %', names;
  end if;
end $$;

commit;
