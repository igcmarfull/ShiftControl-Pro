-- Evidencia fotográfica de checklists.
--
-- Las fotos se guardan en Supabase Storage (bucket privado
-- "checklist-evidence"), no dentro de app_state, para que el estado
-- sincronizado no crezca con cada imagen. La app guarda en el checklist solo
-- la ruta del archivo.
--
-- Ruta de cada archivo: <company_id>/checklists/<área>/<fecha>/<archivo>.
-- Solo los miembros activos de esa empresa pueden subir y ver sus archivos.
-- No se permite modificar ni borrar evidencia desde la app.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-evidence',
  'checklist-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
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

drop policy if exists "checklist_evidence_insert_for_members" on storage.objects;
create policy "checklist_evidence_insert_for_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'checklist-evidence'
  and public.is_active_company_member_folder((storage.foldername(name))[1])
);

drop policy if exists "checklist_evidence_select_for_members" on storage.objects;
create policy "checklist_evidence_select_for_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'checklist-evidence'
  and public.is_active_company_member_folder((storage.foldername(name))[1])
);

commit;
