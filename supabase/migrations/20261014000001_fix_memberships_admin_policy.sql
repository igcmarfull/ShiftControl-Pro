-- Corrige la policy "company_memberships_select_admin" creada en
-- 20260804000001_team_management.sql.
--
-- Esa policy consultaba company_memberships dentro de una policy de la misma
-- tabla. Postgres la rechaza con "infinite recursion detected in policy for
-- relation company_memberships", lo que bloquea toda lectura de
-- company_memberships y profiles, incluido el inicio de sesión.
--
-- La verificación de administrador pasa a una función security definer, que
-- lee company_memberships sin volver a evaluar sus policies. Es idempotente:
-- puede aplicarse aunque la policy original ya se haya corregido a mano.

begin;

create or replace function public.is_active_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = p_company_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'ADMIN'
      and membership.active = true
  );
$$;

revoke all on function public.is_active_company_admin(uuid) from public, anon;
grant execute on function public.is_active_company_admin(uuid) to authenticated;

drop policy if exists "company_memberships_select_admin"
on public.company_memberships;

create policy "company_memberships_select_admin"
on public.company_memberships
for select
to authenticated
using (public.is_active_company_admin(company_id));

commit;
