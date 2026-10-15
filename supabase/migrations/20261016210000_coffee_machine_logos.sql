-- Logo de las máquinas de café.
--
-- Cambio aditivo:
--   1. coffee_machines.logo_path: ruta del logo en el bucket privado shiftcontrol-machine-logos
--      (<empresa>/<máquina>/<archivo>), solo dentro de la propia máquina.
--   2. coffee_machine_set_logo: el administrador asigna o quita el logo.
--   3. Bucket privado: leen el administrador y la jefa de tienda; solo el administrador sube,
--      reemplaza o borra, y solo en la carpeta de una máquina que exista.
--
-- Reversión: supabase/rollback/20261016210000_coffee_machine_logos.rollback.sql

alter table public.coffee_machines add column logo_path text;
alter table public.coffee_machines add constraint coffee_machines_logo_path_chk check (
  logo_path is null
  or (length(logo_path) <= 300 and logo_path like company_id::text || '/' || id::text || '/%')
);

create function public.coffee_machine_set_logo(p_machine_id uuid, p_logo_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.coffee_machines;
  v_new public.coffee_machines;
  v_path text := nullif(trim(coalesce(p_logo_path, '')), '');
begin
  select * into v_m from public.coffee_machines where id = p_machine_id;
  if not found then
    perform public.inv_fail('not_found', 'La máquina no existe.', null, '42501');
  end if;
  if not public.is_company_admin(v_m.company_id) then
    perform public.inv_fail('forbidden', 'Solo el administrador cambia el logo.', null, '42501');
  end if;
  if v_path is not null and v_path not like v_m.company_id::text || '/' || v_m.id::text || '/%' then
    perform public.inv_fail('invalid_logo', 'El logo no pertenece a esta máquina.');
  end if;
  update public.coffee_machines set logo_path = v_path, updated_at = now() where id = v_m.id returning * into v_new;
  return to_jsonb(v_new);
end;
$$;
revoke all on function public.coffee_machine_set_logo(uuid, text) from public, anon;
grant execute on function public.coffee_machine_set_logo(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shiftcontrol-machine-logos', 'shiftcontrol-machine-logos', false, 204800,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function public.coffee_can_read_logo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and array_length(f, 1) >= 2 then public.coffee_can_access(f[1]::uuid)
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

create function public.coffee_can_manage_logo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f[1] ~* '^[0-9a-f-]{36}$' and f[2] ~* '^[0-9a-f-]{36}$' and array_length(f, 1) >= 2
        then public.is_company_admin(f[1]::uuid)
             and exists (select 1 from public.coffee_machines m where m.id = f[2]::uuid and m.company_id = f[1]::uuid)
      else false
    end
    from (select storage.foldername(p_name) as f) x
  ), false);
$$;

revoke all on function public.coffee_can_read_logo_path(text) from public, anon;
revoke all on function public.coffee_can_manage_logo_path(text) from public, anon;
grant execute on function public.coffee_can_read_logo_path(text) to authenticated;
grant execute on function public.coffee_can_manage_logo_path(text) to authenticated;

create policy "shiftcontrol_machine_logos_select"
on storage.objects for select to authenticated
using (bucket_id = 'shiftcontrol-machine-logos' and public.coffee_can_read_logo_path(name));
create policy "shiftcontrol_machine_logos_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'shiftcontrol-machine-logos' and public.coffee_can_manage_logo_path(name));
create policy "shiftcontrol_machine_logos_update"
on storage.objects for update to authenticated
using (bucket_id = 'shiftcontrol-machine-logos' and public.coffee_can_manage_logo_path(name))
with check (bucket_id = 'shiftcontrol-machine-logos' and public.coffee_can_manage_logo_path(name));
create policy "shiftcontrol_machine_logos_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'shiftcontrol-machine-logos' and public.coffee_can_manage_logo_path(name));
