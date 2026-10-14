-- REVERSIÓN del módulo Inventarios (migraciones 20261015000100, 20261015000200
-- y 20261015000300).
--
-- NO es una migración: está fuera de supabase/migrations/ a propósito. Se
-- ejecuta a mano, solo si hay que retirar el módulo del servidor.
--
-- ATENCIÓN: ELIMINA TODOS LOS DATOS DE INVENTARIOS (productos, movimientos,
-- recepciones, conteos, ajustes y auditoría de inventarios). Antes de ejecutar,
-- respalda las tablas inv_* (por ejemplo con el panel de Supabase o pg_dump).
-- No toca app_state, membresías ni ningún otro dato de ShiftControl.
--
-- Después de revertir, la sección Inventarios de la app muestra «Aún no está
-- habilitado» y el resto de la aplicación sigue igual.
--
-- Todo ocurre en una transacción: si algo falla, no cambia nada.

begin;

-- Funciones del módulo (todas se llaman inv_*; incluye triggers y ayudantes).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'inv\_%'
  loop
    execute 'drop function if exists ' || f.signature || ' cascade';
  end loop;
end $$;

drop table if exists public.inv_receipt_lines cascade;
drop table if exists public.inv_receipts cascade;
drop table if exists public.inv_count_lines cascade;
drop table if exists public.inv_adjustments cascade;
drop table if exists public.inv_counts cascade;
drop table if exists public.inv_movements cascade;
drop table if exists public.inv_stock cascade;
drop table if exists public.inv_lots cascade;
drop table if exists public.inv_products cascade;
drop table if exists public.inv_locations cascade;
drop table if exists public.inv_requests cascade;
drop table if exists public.inv_audit cascade;
drop table if exists public.inv_inventories cascade;

-- Si se revirtió, quitar también el registro de las migraciones para que una
-- futura aplicación no se considere ya hecha (ajustar a mano si se usó otro nombre).
-- delete from supabase_migrations.schema_migrations
--  where version in ('20261015000100','20261015000200','20261015000300');

commit;
