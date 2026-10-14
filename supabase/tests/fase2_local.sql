-- Prueba de la fase 2 (app_state solo para el administrador).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas,
-- incluida 20261014200100. Crea usuarios y empresas ficticios dentro de una
-- transacción que termina en ROLLBACK. No ejecutar contra producción: para
-- producción usar supabase/tests/fase2_produccion.sql.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/fase2_local.sql
--
-- Cada comprobación imprime "PASS ..." y la primera que falle detiene el
-- script con "FAIL ...". Al final imprime "FASE 2: TODAS LAS PRUEBAS PASARON".

begin;

-- Identificadores ficticios.
-- Empresa A: admin, jefa de isla (activa), jefa de tienda (inactiva).
-- Empresa B: admin ajeno.
create temp table ids as select
  '00000000-0000-0000-0000-00000000a001'::uuid as company_a,
  '00000000-0000-0000-0000-00000000b001'::uuid as company_b,
  '00000000-0000-0000-0000-0000000000a1'::uuid as admin_a,
  '00000000-0000-0000-0000-0000000000c1'::uuid as chief_isla,
  '00000000-0000-0000-0000-0000000000c2'::uuid as chief_tienda,
  '00000000-0000-0000-0000-0000000000b1'::uuid as admin_b;
grant select on ids to authenticated, anon;

insert into auth.users (id, email)
select u, u::text || '@example.invalid'
from ids, lateral unnest(array[admin_a, chief_isla, chief_tienda, admin_b]) u;

insert into public.profiles (id, display_name, active)
select id, 'Prueba ' || right(id::text, 2), true from auth.users
on conflict (id) do update set active = true;

insert into public.companies (id, name) select company_a, 'Empresa A' from ids;
insert into public.companies (id, name) select company_b, 'Empresa B' from ids;

insert into public.company_memberships (company_id, user_id, role, area, active)
select company_a, admin_a,      'ADMIN', null,       true  from ids union all
select company_a, chief_isla,   'CHIEF', 'ESTACION', true  from ids union all
select company_a, chief_tienda, 'CHIEF', 'TIENDA',   false from ids union all
select company_b, admin_b,      'ADMIN', null,       true  from ids;

insert into public.app_state (company_id, key, data, updated_at)
select company_a, 'main', jsonb_build_object(
  'settings', jsonb_build_object('company', 'Empresa A'),
  'employees', jsonb_build_array(
    jsonb_build_object('id', 'e-isla-1',   'name', 'Isla Uno',   'area', 'Isla'),
    jsonb_build_object('id', 'e-isla-2',   'name', 'Isla Dos',   'area', 'Isla'),
    jsonb_build_object('id', 'e-tienda-1', 'name', 'Tienda Uno', 'area', 'TIENDA')),
  'plans', jsonb_build_array(
    jsonb_build_object('id', 'p1', 'employeeId', 'e-isla-1',   'date', '2026-10-01', 'shift', 'A'),
    jsonb_build_object('id', 'p2', 'employeeId', 'e-tienda-1', 'date', '2026-10-01', 'shift', 'B')),
  'invoices', jsonb_build_array(
    jsonb_build_object('id', 'i1', 'area', 'TIENDA', 'aprobacion', 'pendiente', 'monto', 1000),
    jsonb_build_object('id', 'i2', 'aprobacion', 'aprobada', 'monto', 2000)),
  'deposits', jsonb_build_array(jsonb_build_object('id', 'd1', 'monto', 5000)),
  'audit', jsonb_build_array(jsonb_build_object('id', 'a1', 'action', 'semilla'))
), '2026-10-01T00:00:00Z' from ids;

-- Otra clave: producción conserva un UNIQUE (key) heredado de la tabla original.
insert into public.app_state (company_id, key, data)
select company_b, 'main-b', '{"settings":{"company":"Empresa B"}}'::jsonb from ids;

-- Helpers: ejecutar como un usuario autenticado (rol y claim de Supabase).
create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end $$;

-- 1. Administrador: acceso completo, como antes.
do $$
declare ids record; n int; rc int;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.admin_a);
  select count(*) into n from public.app_state;
  if n <> 1 then reset role; raise exception 'FAIL admin lee solo su empresa (vio % filas)', n; end if;
  update public.app_state set data = data where company_id = ids.company_a;
  get diagnostics rc = row_count;
  if rc <> 1 then reset role; raise exception 'FAIL admin actualiza su fila (% filas)', rc; end if;
  insert into public.app_state (company_id, key, data) values (ids.company_a, 'otra-clave', '{}');
  update public.app_state set data = '{"x":1}' where company_id = ids.company_a and key = 'otra-clave';
  update public.app_state set data = data where company_id = ids.company_b;
  get diagnostics rc = row_count;
  reset role;
  if rc <> 0 then raise exception 'FAIL admin no debe modificar otra empresa (% filas)', rc; end if;
  raise notice 'PASS administrador: lee, actualiza e inserta en su empresa; no toca otra';
end $$;

-- 2. Jefa de isla activa: sin acceso directo a app_state.
do $$
declare ids record; n int; rc int; denied boolean := false;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.chief_isla);
  select count(*) into n from public.app_state;
  if n <> 0 then reset role; raise exception 'FAIL jefa de isla lee app_state directo (% filas)', n; end if;
  update public.app_state set data = '{"hackeado":true}' where company_id = ids.company_a;
  get diagnostics rc = row_count;
  if rc <> 0 then reset role; raise exception 'FAIL jefa de isla actualiza app_state directo (% filas)', rc; end if;
  begin
    insert into public.app_state (company_id, key, data) values (ids.company_a, 'intruso', '{}');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then reset role; raise exception 'FAIL jefa de isla inserta en app_state'; end if;
  begin
    delete from public.app_state where company_id = ids.company_a;
    get diagnostics rc = row_count;
  exception when insufficient_privilege then rc := 0;
  end;
  reset role;
  if rc <> 0 then raise exception 'FAIL jefa de isla borra de app_state (% filas)', rc; end if;
  raise notice 'PASS jefa de isla: select, update, insert y delete directos bloqueados';
end $$;

-- 3. Jefa de isla por las funciones del servidor: sigue funcionando.
do $$
declare ids record; r jsonb; v timestamptz; saved jsonb; n int; before_data jsonb; after_data jsonb;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.chief_isla);
  r := public.get_area_app_state(ids.company_a, 'main');
  if jsonb_array_length(r->'data'->'employees') <> 2 then
    reset role; raise exception 'FAIL jefa de isla debe recibir 2 trabajadoras (recibió %)', jsonb_array_length(r->'data'->'employees');
  end if;
  if r->'data'->'employees' @> '[{"id":"e-tienda-1"}]' then
    reset role; raise exception 'FAIL jefa de isla recibió personal de tienda';
  end if;
  if jsonb_array_length(r->'data'->'plans') <> 1 or jsonb_array_length(r->'data'->'invoices') <> 0
     or jsonb_array_length(r->'data'->'deposits') <> 0 or jsonb_array_length(r->'data'->'audit') <> 0 then
    reset role; raise exception 'FAIL jefa de isla recibió datos de otra área o finanzas: %', r->'data';
  end if;
  v := public.get_app_state_version(ids.company_a, 'main');
  if v is null then reset role; raise exception 'FAIL get_app_state_version devolvió null'; end if;
  reset role;
  raise notice 'PASS jefa de isla: lectura por área (2 trabajadoras, 1 turno, sin facturas ni finanzas ni historial)';

  -- Guardar sin cambios deja el estado idéntico.
  select data into before_data from public.app_state where company_id = ids.company_a and key = 'main';
  perform pg_temp.as_user(ids.chief_isla);
  saved := public.save_area_app_state(ids.company_a, 'main', v, r->'data');
  reset role;
  select data into after_data from public.app_state where company_id = ids.company_a and key = 'main';
  if before_data is distinct from after_data then
    raise exception 'FAIL guardar sin cambios alteró el estado';
  end if;
  raise notice 'PASS jefa de isla: guardar sin cambios deja el estado idéntico';

  -- Un cambio propio se guarda; datos ajenos enviados se ignoran.
  perform pg_temp.as_user(ids.chief_isla);
  v := public.get_app_state_version(ids.company_a, 'main');
  saved := public.save_area_app_state(ids.company_a, 'main', v,
    jsonb_set(r->'data', '{plans}', (r->'data'->'plans') || jsonb_build_array(
      jsonb_build_object('id', 'p3', 'employeeId', 'e-isla-2', 'date', '2026-10-02', 'shift', 'C'),
      jsonb_build_object('id', 'p4', 'employeeId', 'e-tienda-1', 'date', '2026-10-02', 'shift', 'C')))
    || jsonb_build_object('invoices', jsonb_build_array(
         jsonb_build_object('id', 'i3', 'area', 'ISLA', 'aprobacion', 'aprobada', 'monto', 99))));
  reset role;
  select jsonb_array_length(data->'plans') into n from public.app_state where company_id = ids.company_a and key = 'main';
  if n <> 3 then raise exception 'FAIL se esperaban 3 turnos tras guardar (hay %): el turno de tienda no debe entrar', n; end if;
  if exists (select 1 from public.app_state, jsonb_array_elements(data->'plans') p
             where company_id = ids.company_a and key = 'main' and p->>'id' = 'p4') then
    raise exception 'FAIL la jefa de isla escribió un turno de tienda';
  end if;
  if exists (select 1 from public.app_state, jsonb_array_elements(data->'invoices') i
             where company_id = ids.company_a and key = 'main' and i->>'id' = 'i3' and i->>'aprobacion' = 'aprobada') then
    raise exception 'FAIL la jefa de isla se autoaprobó una factura';
  end if;
  raise notice 'PASS jefa de isla: guarda su turno; turno de tienda rechazado; factura no queda aprobada';
end $$;

-- 4. Concurrencia: una versión vieja se rechaza (40001).
do $$
declare ids record; r jsonb; stale boolean := false;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.chief_isla);
  r := public.get_area_app_state(ids.company_a, 'main');
  begin
    perform public.save_area_app_state(ids.company_a, 'main', '2020-01-01T00:00:00Z', r->'data');
  exception when sqlstate '40001' then stale := true;
  end;
  reset role;
  if not stale then raise exception 'FAIL una versión vieja no fue rechazada'; end if;
  raise notice 'PASS versión vieja rechazada con 40001';
end $$;

-- 5. Jefa de tienda inactiva: sin acceso por ninguna vía.
do $$
declare ids record; n int; blocked boolean := false;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.chief_tienda);
  select count(*) into n from public.app_state;
  if n <> 0 then reset role; raise exception 'FAIL jefa de tienda inactiva lee app_state'; end if;
  begin
    perform public.get_area_app_state(ids.company_a, 'main');
  exception when insufficient_privilege then blocked := true;
  end;
  reset role;
  if not blocked then raise exception 'FAIL jefa de tienda inactiva accedió por la función'; end if;
  raise notice 'PASS jefa de tienda inactiva: sin acceso directo ni por función';
end $$;

-- 6. Reactivación de la jefa de tienda: solo ve su área.
update public.company_memberships m set active = true
from ids where m.user_id = ids.chief_tienda;

do $$
declare ids record; r jsonb; n int;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.chief_tienda);
  select count(*) into n from public.app_state;
  if n <> 0 then reset role; raise exception 'FAIL jefa de tienda reactivada lee app_state directo'; end if;
  r := public.get_area_app_state(ids.company_a, 'main');
  reset role;
  if r->>'area' <> 'TIENDA' then raise exception 'FAIL el área devuelta no es TIENDA: %', r->>'area'; end if;
  if jsonb_array_length(r->'data'->'employees') <> 1
     or r->'data'->'employees' @> '[{"id":"e-isla-1"}]' then
    raise exception 'FAIL jefa de tienda debe ver solo su trabajadora: %', r->'data'->'employees';
  end if;
  if jsonb_array_length(r->'data'->'plans') <> 1 or jsonb_array_length(r->'data'->'deposits') <> 0
     or jsonb_array_length(r->'data'->'audit') <> 0 then
    raise exception 'FAIL jefa de tienda recibió datos de otra área o finanzas';
  end if;
  raise notice 'PASS jefa de tienda reactivada: ve solo Tienda; sin acceso directo a app_state';
end $$;

-- 7. Aislamiento entre empresas y usuarios anónimos.
do $$
declare ids record; n int;
begin
  select * into ids from pg_temp.ids;
  perform pg_temp.as_user(ids.admin_b);
  select count(*) into n from public.app_state where company_id = ids.company_a;
  reset role;
  if n <> 0 then raise exception 'FAIL admin de otra empresa ve datos ajenos'; end if;
  perform pg_temp.as_anon();
  begin
    select count(*) into n from public.app_state;
  exception when insufficient_privilege then n := 0;
  end;
  reset role;
  if n <> 0 then raise exception 'FAIL anónimo lee app_state'; end if;
  raise notice 'PASS otra empresa y anónimos no ven datos';
end $$;

-- 8. Las policies vigentes son exactamente las tres de administrador.
do $$
declare names text;
begin
  select string_agg(policyname, ', ' order by policyname) into names
  from pg_policies where schemaname = 'public' and tablename = 'app_state';
  if names is distinct from 'app_state_insert_for_admins, app_state_select_for_admins, app_state_update_for_admins' then
    raise exception 'FAIL policies inesperadas en app_state: %', names;
  end if;
  raise notice 'PASS policies de app_state: solo las tres de administrador';
end $$;

do $$ begin raise notice 'FASE 2: TODAS LAS PRUEBAS PASARON'; end $$;

rollback;
