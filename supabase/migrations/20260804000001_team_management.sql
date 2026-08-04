-- Gestión de Jefa de Isla: un solo CHIEF activo por empresa, historial de
-- asignaciones, y policies de lectura para que un admin vea a su equipo.

-- Un solo CHIEF activo por empresa, garantizado por la base de datos.
-- Índice parcial: solo aplica a role='CHIEF' and active=true, así que un
-- futuro rol (ej. "Jefa de Tienda") tendría su propio índice equivalente
-- sin tocar este.
create unique index company_memberships_one_active_chief
on public.company_memberships (company_id)
where role = 'CHIEF' and active = true;

-- Historial de asignaciones/reemplazos. Solo la Edge Function (con
-- service_role, que ignora RLS) escribe acá — no hay policy de insert
-- para "authenticated", así que ni un admin puede alterar el historial
-- desde el cliente.
create table public.team_role_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null,
  action text not null check (action in ('assigned', 'replaced')),
  actor_user_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  previous_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.team_role_events enable row level security;

revoke all on table public.team_role_events from anon, authenticated;
grant select on table public.team_role_events to authenticated;

create policy "team_role_events_select_for_admins"
on public.team_role_events
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships membership
    where membership.company_id = team_role_events.company_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'ADMIN'
      and membership.active = true
  )
);

-- Hoy cada usuario solo puede ver su propia fila de profiles/company_memberships.
-- Un admin necesita poder ver a los demás miembros de su empresa (por ejemplo,
-- para saber quién es la Jefa de Isla actual).
create policy "profiles_select_teammates"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships mine
    join public.company_memberships theirs
      on theirs.company_id = mine.company_id
    where mine.user_id = (select auth.uid())
      and mine.active = true
      and theirs.user_id = profiles.id
      and theirs.active = true
  )
);

create policy "company_memberships_select_admin"
on public.company_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.company_memberships admin_check
    where admin_check.company_id = company_memberships.company_id
      and admin_check.user_id = (select auth.uid())
      and admin_check.role = 'ADMIN'
      and admin_check.active = true
  )
);

-- Reemplaza/asigna la Jefa de Isla en una sola transacción atómica:
-- desactiva a la anterior (si hay), activa a la nueva, y deja registro en
-- team_role_events. security definer para poder escribir sin depender de
-- las policies de RLS del caller — pero el execute se revoca de
-- anon/authenticated abajo, así que solo la Edge Function (con
-- service_role) puede invocarla. La app nunca la llama directo.
create or replace function public.assign_chief(
  p_company_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid
)
returns table (action text, previous_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_user_id uuid;
  v_action text;
begin
  select membership.user_id
  into v_previous_user_id
  from public.company_memberships membership
  where membership.company_id = p_company_id
    and membership.role = 'CHIEF'
    and membership.active = true;

  if v_previous_user_id is not null and v_previous_user_id = p_target_user_id then
    raise exception 'Esa persona ya es la Jefa de Isla activa.';
  end if;

  if v_previous_user_id is not null then
    update public.company_memberships
    set active = false
    where company_id = p_company_id
      and user_id = v_previous_user_id;
    v_action := 'replaced';
  else
    v_action := 'assigned';
  end if;

  insert into public.company_memberships (company_id, user_id, role, active)
  values (p_company_id, p_target_user_id, 'CHIEF', true)
  on conflict (company_id, user_id)
  do update set role = 'CHIEF', active = true;

  insert into public.team_role_events (
    company_id, role, action, actor_user_id, target_user_id, previous_user_id
  )
  values (
    p_company_id, 'CHIEF', v_action, p_actor_user_id, p_target_user_id, v_previous_user_id
  );

  return query select v_action, v_previous_user_id;
end;
$$;

revoke all on function public.assign_chief(uuid, uuid, uuid) from public, anon, authenticated;
