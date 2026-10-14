-- Corrige "infinite recursion detected in policy for relation
-- company_memberships", causado por 20260804000001_team_management.sql:
-- la policy company_memberships_select_admin consultaba company_memberships
-- dentro de su propia condición, obligando a Postgres a re-evaluar las
-- policies de esa misma tabla indefinidamente.
--
-- Patrón de arreglo estándar de Supabase: mover el chequeo "¿es admin de
-- esta empresa?" a una función SECURITY DEFINER. Al ejecutarse con los
-- privilegios de quien la creó (el rol de las migraciones, con BYPASSRLS),
-- la consulta interna a company_memberships NO vuelve a disparar RLS —
-- rompe el ciclo sin cambiar qué puede ver cada rol.
--
-- No toca auth.users, profiles, ni los datos de company_memberships
-- (ninguna fila se modifica); solo cambia CÓMO se calcula el permiso de
-- lectura para el rol ADMIN.

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships
    where company_id = p_company_id
      and user_id = auth.uid()
      and role = 'ADMIN'
      and active = true
  );
$$;

revoke all on function public.is_company_admin(uuid) from public, anon;

grant execute on function public.is_company_admin(uuid) to authenticated;

drop policy "company_memberships_select_admin" on public.company_memberships;

create policy "company_memberships_select_admin"
on public.company_memberships
for select
to authenticated
using (
  public.is_company_admin(company_memberships.company_id)
);
