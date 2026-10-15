-- Reversión de 20261015190000_suppliers.sql
--
-- NO es una migración: está fuera de supabase/migrations/ a propósito. Se ejecuta a mano,
-- solo si se decide quitar los proveedores. ATENCIÓN: borra la tabla de proveedores y sus logos.
-- Las facturas no se tocan (siguen guardando el nombre y el RUT del proveedor).

begin;

drop policy if exists "shiftcontrol_supplier_logos_select" on storage.objects;
drop policy if exists "shiftcontrol_supplier_logos_insert" on storage.objects;
drop policy if exists "shiftcontrol_supplier_logos_update" on storage.objects;
drop policy if exists "shiftcontrol_supplier_logos_delete" on storage.objects;
drop function if exists public.can_read_supplier_logo_path(text);
drop function if exists public.can_manage_supplier_logo_path(text);

drop function if exists public.supplier_import(uuid, jsonb);
drop function if exists public.supplier_set_logo(uuid, text, integer);
drop function if exists public.supplier_set_active(uuid, boolean, integer);
drop function if exists public.supplier_save(uuid, jsonb);
drop function if exists public.sup_fail(text, text, text);

drop table if exists public.suppliers;
drop function if exists public.is_company_member(uuid);

delete from storage.objects where bucket_id = 'shiftcontrol-supplier-logos';
delete from storage.buckets where id = 'shiftcontrol-supplier-logos';

commit;
