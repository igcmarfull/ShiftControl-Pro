-- Aislamiento de app_state por área (fase 2: cierra el acceso directo).
--
-- APLICAR SOLO JUNTO CON LA PUBLICACIÓN del cliente que usa
-- get_area_app_state / save_area_app_state (20261014200000). Con el cliente
-- anterior, las jefaturas dejarían de cargar y guardar datos.
--
-- Después de esta migración:
-- - El administrador activo lee y escribe app_state completo, como antes.
-- - Las jefaturas no leen ni escriben app_state directamente; solo acceden a
--   su área mediante las funciones del servidor, que además impiden aprobar
--   facturas o evaluaciones y registrar pagos.

drop policy if exists "app_state_select_for_active_members" on public.app_state;
drop policy if exists "app_state_insert_for_active_members" on public.app_state;
drop policy if exists "app_state_update_for_active_members" on public.app_state;
drop policy if exists "app_state_select_for_admins" on public.app_state;
drop policy if exists "app_state_insert_for_admins" on public.app_state;
drop policy if exists "app_state_update_for_admins" on public.app_state;

create policy "app_state_select_for_admins"
on public.app_state
for select
to authenticated
using (public.is_company_admin(company_id));

create policy "app_state_insert_for_admins"
on public.app_state
for insert
to authenticated
with check (public.is_company_admin(company_id));

create policy "app_state_update_for_admins"
on public.app_state
for update
to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));
