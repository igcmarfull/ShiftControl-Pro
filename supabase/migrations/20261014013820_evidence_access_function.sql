-- Acceso a evidencia por ruta <empresa>/<checklists|invoices>/<ÁREA>/...
-- El administrador activo accede a todas las áreas; una jefa activa solo a
-- la de su área (TIENDA, o ISLA para ESTACION o sin área).
create or replace function public.can_access_evidence_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships membership
    cross join lateral (select storage.foldername(p_name) as folders) path
    where membership.user_id = (select auth.uid())
      and membership.active = true
      and membership.company_id::text = path.folders[1]
      and path.folders[2] in ('checklists', 'invoices')
      and (
        membership.role = 'ADMIN'
        or (
          membership.role = 'CHIEF'
          and path.folders[3] = case when membership.area = 'TIENDA' then 'TIENDA' else 'ISLA' end
        )
      )
  );
$$;

revoke all on function public.can_access_evidence_path(text) from public, anon;
grant execute on function public.can_access_evidence_path(text) to authenticated;
