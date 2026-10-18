-- Pruebas de la migración 20261018170000_handoff_recipients.sql (quién puede recibir una entrega de turno).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con las migraciones de autenticación y equipo aplicadas.
-- Crea empresas y usuarios ficticios dentro de una transacción que termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/entrega_turno_local.sql

begin;

create temp table ctx (k text primary key, v text);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a0001', 'admin-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0002', 'jefa-tienda@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0003', 'jefa-isla@example.invalid'),
  ('00000000-0000-0000-0000-0000000a0004', 'jefa-inactiva@example.invalid'),
  ('00000000-0000-0000-0000-0000000b0001', 'admin-b@example.invalid');
insert into public.profiles (id, display_name, active)
select id, 'Prueba ' || right(id::text, 4), true from auth.users on conflict (id) do update set active = true;
insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-00000000000a', 'Empresa A'),
  ('00000000-0000-0000-0000-00000000000b', 'Empresa B');
insert into public.company_memberships (company_id, user_id, role, area, active) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0001', 'ADMIN', null, true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0002', 'CHIEF', 'TIENDA', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0003', 'CHIEF', 'ESTACION', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000a0004', 'CHIEF', 'TIENDA', false),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000b0001', 'ADMIN', null, true);
insert into ctx values
  ('A', '00000000-0000-0000-0000-00000000000a'), ('B', '00000000-0000-0000-0000-00000000000b'),
  ('adm', '00000000-0000-0000-0000-0000000a0001'), ('jt', '00000000-0000-0000-0000-0000000a0002'),
  ('ji', '00000000-0000-0000-0000-0000000a0003'), ('off', '00000000-0000-0000-0000-0000000a0004'),
  ('admB', '00000000-0000-0000-0000-0000000b0001');

create function pg_temp.g(p_k text) returns text language sql as $$ select v from ctx where k = p_k $$;
create function pg_temp.put(p_k text, p_v text) returns void language sql as $$
  insert into ctx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.call(p_user text, p_sql text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end $$;
create function pg_temp.try(p_user text, p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.g(p_user), true);
  begin
    set local role authenticated;
    execute p_sql;
    reset role;
    return 'OK';
  exception when others then
    reset role;
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;
create function pg_temp.ok(p_name text, p_cond boolean, p_detail text default '') returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL %  %', p_name, p_detail; end if;
  raise notice 'PASS %', p_name;
end $$;

do $$
declare r jsonb;
begin
  -- Administrador: ve las jefaturas activas de las dos áreas, no la inactiva ni a sí mismo ni a otra empresa.
  r := pg_temp.call('adm', 'select public.handoff_recipients()');
  perform pg_temp.ok('El administrador ve a las dos jefas activas', jsonb_array_length(r) = 2, r::text);
  perform pg_temp.ok('Las áreas salen normalizadas', (select bool_and(e->>'area' in ('ISLA','TIENDA')) from jsonb_array_elements(r) e), r::text);
  perform pg_temp.ok('La jefa de Isla (ESTACION) figura como ISLA', exists (select 1 from jsonb_array_elements(r) e where e->>'role' = 'CHIEF' and e->>'area' = 'ISLA'), r::text);
  perform pg_temp.ok('No aparece la jefa inactiva', not exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('off')), r::text);
  perform pg_temp.ok('No aparece el propio administrador', not exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('adm')), r::text);
  perform pg_temp.ok('No aparece la otra empresa', not exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('admB')), r::text);

  -- Jefa de Isla: ve al administrador, no a la jefa de Tienda ni a sí misma.
  r := pg_temp.call('ji', 'select public.handoff_recipients()');
  perform pg_temp.ok('La jefa de Isla ve al administrador', exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('adm') and e->>'role' = 'ADMIN'), r::text);
  perform pg_temp.ok('La jefa de Isla no ve a la de Tienda', not exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('jt')), r::text);
  perform pg_temp.ok('La jefa de Isla no se ve a sí misma', not exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = pg_temp.g('ji')), r::text);
  perform pg_temp.ok('El nombre viene del perfil', length(coalesce(r->0->>'name','')) > 0, r::text);

  -- Jefa de Tienda: ve al administrador, no a la de Isla.
  r := pg_temp.call('jt', 'select public.handoff_recipients()');
  perform pg_temp.ok('La jefa de Tienda ve solo al administrador', jsonb_array_length(r) = 1 and r->0->>'role' = 'ADMIN', r::text);
end $$;

do $$
declare v_msg text;
begin
  v_msg := pg_temp.try('off', 'select public.handoff_recipients()');
  perform pg_temp.ok('Una jefa inactiva no puede consultar', v_msg ilike '%no tienes acceso%', v_msg);
  v_msg := pg_temp.try('admB', 'select public.handoff_recipients()');
  perform pg_temp.ok('Otra empresa solo ve lo suyo (sin error, lista vacía)', v_msg = 'OK', v_msg);
end $$;

do $$ begin raise notice 'ENTREGA DE TURNO: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
