-- Pruebas de la migración 20261016210000_coffee_machine_logos.sql (logo de las máquinas de café).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y proveedores).
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/maquinas_cafe_logos_local.sql
--
-- Cada comprobación imprime "PASS ..."; la primera que falle detiene el script
-- con "FAIL ...". Al final imprime " LAS PRUEBAS PASARON".

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

-- ---------------------------------------------------------------------------
-- Preparación
-- ---------------------------------------------------------------------------
do $$
declare r jsonb;
begin
  r := pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"Marley","codes":[{"code":"219113"}]}'));
  perform pg_temp.put('m1', r->>'id');
  r := pg_temp.call('admB', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('B'), '{"name":"Otra empresa"}'));
  perform pg_temp.put('mB', r->>'id');
end $$;

do $$
declare r jsonb; v_msg text; v_n jsonb; v_path text; v_pathB text;
begin
  v_path := pg_temp.g('A') || '/' || pg_temp.g('m1') || '/logo.webp';
  -- 1. Asignar el logo
  r := pg_temp.call('adm', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), v_path));
  perform pg_temp.ok('El admin asigna el logo', r->>'logo_path' = v_path, r::text);
  v_msg := pg_temp.try('adm', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), pg_temp.g('A') || '/' || gen_random_uuid() || '/x.webp'));
  perform pg_temp.ok('Un logo de otra máquina se rechaza', v_msg = 'inv:invalid_logo', v_msg);
  v_msg := pg_temp.try('adm', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), pg_temp.g('B') || '/' || pg_temp.g('m1') || '/x.webp'));
  perform pg_temp.ok('Un logo de otra empresa se rechaza', v_msg = 'inv:invalid_logo', v_msg);
  v_msg := pg_temp.try('jt', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), v_path));
  perform pg_temp.ok('La jefa no cambia el logo', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('admB', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), v_path));
  perform pg_temp.ok('Otra empresa no toca la máquina', v_msg = 'inv:forbidden', v_msg);
  r := pg_temp.call('adm', format('select public.coffee_machine_set_logo(%L, NULL)', pg_temp.g('m1')));
  perform pg_temp.ok('El admin quita el logo', r->>'logo_path' is null, r::text);
  perform pg_temp.call('adm', format('select public.coffee_machine_set_logo(%L, %L)', pg_temp.g('m1'), v_path));
  r := pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), json_build_object('id', pg_temp.g('m1'), 'tolerance', 7)::text));
  perform pg_temp.ok('Editar la máquina conserva el logo', r->>'logo_path' = v_path, r::text);

  -- 2. Archivos del bucket
  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-machine-logos', %L)$f$, v_path));
  perform pg_temp.ok('El admin sube el archivo', v_msg = 'OK', v_msg);
  v_msg := pg_temp.try('jt', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-machine-logos', %L)$f$, pg_temp.g('A') || '/' || pg_temp.g('m1') || '/otro.webp'));
  perform pg_temp.ok('La jefa no sube archivos', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('admB', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-machine-logos', %L)$f$, pg_temp.g('A') || '/' || pg_temp.g('m1') || '/b.webp'));
  perform pg_temp.ok('Un admin de otra empresa no sube aquí', v_msg ilike '%row-level security%', v_msg);
  v_msg := pg_temp.try('adm', format($f$insert into storage.objects (bucket_id, name) values ('shiftcontrol-machine-logos', %L)$f$, pg_temp.g('A') || '/' || gen_random_uuid() || '/f.webp'));
  perform pg_temp.ok('Una máquina inexistente se rechaza', v_msg ilike '%row-level security%', v_msg);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-machine-logos'$q$);
  perform pg_temp.ok('La jefa de tienda lo ve', (v_n#>>'{}')::int = 1, v_n::text);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-machine-logos'$q$);
  perform pg_temp.ok('La jefa de isla no lo ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('off', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-machine-logos'$q$);
  perform pg_temp.ok('Una jefa inactiva no lo ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from storage.objects where bucket_id = 'shiftcontrol-machine-logos'$q$);
  perform pg_temp.ok('Otra empresa no lo ve', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('jt', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('La jefa no borra el archivo', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('adm', format($q$with d as (delete from storage.objects where name = %L returning 1) select to_jsonb(count(*)) from d$q$, v_path));
  perform pg_temp.ok('El admin sí', (v_n#>>'{}')::int = 1, v_n::text);
end $$;

do $$ begin raise notice 'LOGOS DE MÁQUINAS: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
