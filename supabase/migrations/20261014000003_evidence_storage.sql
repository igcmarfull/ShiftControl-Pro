-- Evidencia y respaldos: fotos de checklists y respaldos de facturas.
--
-- Los archivos se guardan en Supabase Storage (bucket privado
-- "shiftcontrol-evidence"), no dentro de app_state, para que el estado
-- sincronizado no crezca con cada archivo. La app guarda solo la ruta.
--
-- Rutas:
--   <company_id>/checklists/<área>/<fecha>/<archivo>
--   <company_id>/invoices/<área>/<mes>/<archivo>
-- Solo los miembros activos de esa empresa pueden subir y ver sus archivos.
-- No se permite modificar ni borrar evidencia desde la app.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shiftcontrol-evidence',
  'shiftcontrol-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Recibe texto porque la carpeta de la ruta puede no ser un uuid válido.
create or replace function public.is_active_company_member_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id::text = p_folder
      and membership.user_id = (select auth.uid())
      and membership.active = true
  );
$$;

revoke all on function public.is_active_company_member_folder(text) from public, anon;
grant execute on function public.is_active_company_member_folder(text) to authenticated;

drop policy if exists "shiftcontrol_evidence_insert_for_members" on storage.objects;
create policy "shiftcontrol_evidence_insert_for_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'shiftcontrol-evidence'
  and public.is_active_company_member_folder((storage.foldername(name))[1])
);

drop policy if exists "shiftcontrol_evidence_select_for_members" on storage.objects;
create policy "shiftcontrol_evidence_select_for_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'shiftcontrol-evidence'
  and public.is_active_company_member_folder((storage.foldername(name))[1])
);

commit;
