-- Reversión de 20261016210000_coffee_machine_logos.sql.
-- Quita los logos de las máquinas (los archivos del bucket hay que borrarlos desde Storage).
drop policy if exists "shiftcontrol_machine_logos_select" on storage.objects;
drop policy if exists "shiftcontrol_machine_logos_insert" on storage.objects;
drop policy if exists "shiftcontrol_machine_logos_update" on storage.objects;
drop policy if exists "shiftcontrol_machine_logos_delete" on storage.objects;
drop function if exists public.coffee_can_read_logo_path(text);
drop function if exists public.coffee_can_manage_logo_path(text);
drop function if exists public.coffee_machine_set_logo(uuid, text);
alter table public.coffee_machines drop constraint if exists coffee_machines_logo_path_chk;
alter table public.coffee_machines drop column if exists logo_path;
