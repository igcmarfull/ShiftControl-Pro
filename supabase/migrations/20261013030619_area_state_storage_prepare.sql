-- PREPARACIÓN: almacenamiento segregado por área.
-- NO aplicar como sustituto de la migración del cliente: src/storage.js
-- todavía utiliza app_state (JSON completo de la empresa).
-- Requiere migraciones 001 y 002 de esta serie.

begin;

create table if not exists public.area_state (
  company_id uuid not null references public.companies(id) on delete cascade,
  area text not null check (area in ('ESTACION','TIENDA')),
  key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (company_id, area, key)
);

alter table public.area_state enable row level security;
revoke all on public.area_state from anon, authenticated;
grant select, insert, update on public.area_state to authenticated;

-- ADMIN ve ambas áreas. CHIEF solo la asignada.
-- La condición se evalúa en la base de datos, no en JavaScript.
create policy area_state_select_member
on public.area_state for select to authenticated
using (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = area_state.company_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (m.role = 'ADMIN' or (m.role = 'CHIEF' and m.area = area_state.area))
  )
);

create policy area_state_insert_member
on public.area_state for insert to authenticated
with check (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = area_state.company_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (m.role = 'ADMIN' or (m.role = 'CHIEF' and m.area = area_state.area))
  )
);

create policy area_state_update_member
on public.area_state for update to authenticated
using (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = area_state.company_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (m.role = 'ADMIN' or (m.role = 'CHIEF' and m.area = area_state.area))
  )
)
with check (
  exists (
    select 1 from public.company_memberships m
    where m.company_id = area_state.company_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and (m.role = 'ADMIN' or (m.role = 'CHIEF' and m.area = area_state.area))
  )
);

-- Importante: NO se modifican las policies de app_state aquí.
-- Antes de activar CHIEF por área, restringir app_state a ADMIN
-- y migrar el cliente a area_state, evitando filtraciones y pérdida de datos.
-- Asimismo, implementar control de versiones para evitar sobrescrituras
-- concurrentes: el upsert directo aún no lo resuelve.

commit;
