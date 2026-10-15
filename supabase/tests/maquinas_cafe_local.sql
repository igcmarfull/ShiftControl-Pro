-- Pruebas de la migración 20261016180000_coffee_machines.sql (máquinas de café: numeral contra ventas).
--
-- SOLO PARA UNA BASE LOCAL DESECHABLE con todas las migraciones aplicadas (incluidas inventario y proveedores).
-- Crea empresas, usuarios y datos ficticios dentro de una transacción que
-- termina en ROLLBACK. No ejecutar contra producción.
--
-- Uso:
--   psql -d <base_local> -v ON_ERROR_STOP=1 -f supabase/tests/maquinas_cafe_local.sql
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
create function pg_temp.d(p_back integer) returns text language sql as $$
  select to_char((now() at time zone 'America/Santiago')::date - p_back, 'YYYY-MM-DD') $$;
create function pg_temp.lines(variadic p_items text[]) returns text language plpgsql as $$
declare v jsonb := '[]'::jsonb; i integer := 1;
begin
  while i <= array_length(p_items, 1) loop
    v := v || jsonb_build_object('date', p_items[i], 'code', p_items[i+1], 'qty', p_items[i+2]::integer);
    i := i + 3;
  end loop;
  return v::text;
end $$;
create function pg_temp.reading(p_user text, p_machine text, p_back integer, p_shift text, p_numeral bigint) returns text language sql as $$
  select pg_temp.try(p_user, format('select public.coffee_save_reading(%L, %L, %L, %L, %s)', pg_temp.g('A'), pg_temp.g(p_machine), pg_temp.d(p_back), p_shift, p_numeral)) $$;

do $$
declare r jsonb; i jsonb; p jsonb; v_msg text;
begin
  r := pg_temp.call('adm', format('select public.inv_setup(%L)', pg_temp.g('A')));
  for i in select * from jsonb_array_elements(r->'inventories') loop
    perform pg_temp.put('inv_' || (i->>'code'), i->>'id');
  end loop;
  p := pg_temp.call('adm', format('select public.inv_save_product(%L, %L::jsonb)', pg_temp.g('inv_tienda'), '{"code":"T1","name":"Red Bull","control_unit":"unidad"}'));
  perform pg_temp.put('pt', p->>'id');
  perform pg_temp.call('adm', format('select public.inv_receive(%L, %L, %L::jsonb, %L::jsonb)', gen_random_uuid(), pg_temp.g('inv_tienda'),
    '{"supplier":"P","document_no":"F1"}', json_build_array(json_build_object('product_id', pg_temp.g('pt'), 'qty', 50))::text));
end $$;

do $$
declare r jsonb; v_msg text; v_n jsonb; v_mid text; v_nid text;
begin
  -- 1. Máquinas
  r := pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'),
    '{"name":"Marley","tolerance":5,"codes":[{"code":"219113"},{"code":"219109"}]}'));
  perform pg_temp.put('m1', r->>'id');
  perform pg_temp.ok('El admin crea la máquina con sus códigos', (select count(*) from public.coffee_machine_codes where machine_id = (r->>'id')::uuid) = 2, r::text);
  r := pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"Nescafé","codes":[{"code":"221608"}]}'));
  perform pg_temp.put('m2', r->>'id');
  v_msg := pg_temp.try('jt', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"Otra"}'));
  perform pg_temp.ok('La jefa no configura máquinas', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"marley"}'));
  perform pg_temp.ok('El nombre no se repite', v_msg = 'inv:duplicate_name', v_msg);
  v_msg := pg_temp.try('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), '{"name":"X","codes":[{"code":"219113"}]}'));
  perform pg_temp.ok('Un código no pertenece a dos máquinas', v_msg = 'inv:duplicate_code', v_msg);

  -- 2. Lecturas
  perform pg_temp.ok('La jefa de tienda anota un numeral', pg_temp.reading('jt', 'm1', 3, 'C', 1000) = 'OK');
  perform pg_temp.ok('...y otro día', pg_temp.reading('jt', 'm1', 2, 'C', 1030) = 'OK');
  perform pg_temp.ok('...y otro turno del mismo día con un numeral menor', pg_temp.reading('jt', 'm1', 2, 'A', 1010) = 'OK');
  perform pg_temp.ok('El admin anota la lectura de ayer', pg_temp.reading('adm', 'm1', 1, 'C', 1062) = 'OK');
  v_msg := pg_temp.reading('jt', 'm1', 3, 'C', 999);
  perform pg_temp.ok('La jefa no corrige una lectura guardada', v_msg = 'inv:already_read', v_msg);
  perform pg_temp.ok('El admin sí corrige', pg_temp.reading('adm', 'm1', 3, 'C', 1000) = 'OK');
  v_msg := pg_temp.reading('adm', 'm1', -2, 'C', 1);
  perform pg_temp.ok('Una fecha futura se rechaza', v_msg = 'inv:invalid_date', v_msg);
  v_msg := pg_temp.reading('adm', 'm1', 0, 'D', 1);
  perform pg_temp.ok('Un turno inválido se rechaza', v_msg = 'inv:invalid_shift', v_msg);
  v_msg := pg_temp.reading('adm', 'm1', 0, 'A', -5);
  perform pg_temp.ok('Un numeral negativo se rechaza', v_msg = 'inv:invalid_numeral', v_msg);
  v_msg := pg_temp.reading('ji', 'm1', 0, 'A', 5);
  perform pg_temp.ok('La jefa de isla no anota', v_msg = 'inv:forbidden', v_msg);

  -- 3. Sin ventas cargadas, el tramo queda pendiente
  r := pg_temp.call('jt', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Sin ventas cargadas el estado es pendiente', jsonb_array_length(r->'rows') = 2 and (r->'rows'->0->>'status') = 'pending', r::text);
  r := pg_temp.call('jt', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m2')));
  perform pg_temp.ok('Una máquina sin lecturas no tiene tramos', jsonb_array_length(r->'rows') = 0, r::text);

  -- 4. La importación registra las ventas de máquina sin tocar stock
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(2),'219113','20', pg_temp.d(2),'219109','8', pg_temp.d(1),'219113','30', pg_temp.d(1),'T1','4')));
  perform pg_temp.ok('Registra las ventas de la máquina', (r->>'machine_lines')::int = 3 and (r->>'machine_units')::int = 58, r::text);
  perform pg_temp.ok('...y descuenta el producto normal', (r->>'applied_lines')::int = 1 and (r->>'units_applied')::int = 4, r::text);
  v_n := pg_temp.call('adm', $q$select to_jsonb(count(*)) from public.inv_products where code in ('219113','219109')$q$);
  perform pg_temp.ok('Los códigos de máquina no crean productos', (v_n#>>'{}')::int = 0, v_n::text);
  r := pg_temp.call('adm', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'),
    pg_temp.lines(pg_temp.d(2),'219113','20', pg_temp.d(1),'219113','31')));
  perform pg_temp.ok('Repetir un día no lo duplica; otra cantidad se informa', (r->>'already')::int = 1 and jsonb_array_length(r->'changed') = 1, r::text);

  -- 5. Cuadratura
  r := pg_temp.call('jt', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Entre dos días el numeral avanza 30 y se vendieron 28', (r->'rows'->1->>'advanced')::int = 30 and (r->'rows'->1->>'sold')::int = 28 and (r->'rows'->1->>'diff')::int = 2, r::text);
  perform pg_temp.ok('Dentro de la tolerancia cuadra', (r->'rows'->0->>'status') = 'ok' and (r->'rows'->1->>'status') = 'ok', r::text);
  perform pg_temp.ok('El numeral del día es el más alto de sus turnos', (r->'rows'->1->>'prev_numeral')::int = 1000 and (r->'rows'->1->>'numeral')::int = 1030, r::text);
  perform pg_temp.call('adm', format('select public.coffee_machine_save(%L, %L::jsonb)', pg_temp.g('A'), json_build_object('id', pg_temp.g('m1'), 'tolerance', 1)::text));
  r := pg_temp.call('adm', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Con tolerancia 1 una diferencia de 2 se marca', (r->'rows'->0->>'status') = 'over', r::text);
  perform pg_temp.ok('Editar la máquina conserva sus códigos', (select count(*) from public.coffee_machine_codes where machine_id = pg_temp.g('m1')::uuid) = 2);
  perform pg_temp.reading('adm', 'm1', 0, 'C', 500);
  r := pg_temp.call('adm', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Si el numeral baja se informa un reinicio', (r->'rows'->0->>'status') = 'reset', r::text);

  -- 6. Permisos y aislamiento
  v_msg := pg_temp.try('ji', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('La jefa de isla no ve la cuadratura', v_msg = 'inv:forbidden', v_msg);
  v_n := pg_temp.call('ji', $q$select to_jsonb(count(*)) from public.coffee_readings$q$);
  perform pg_temp.ok('...ni las lecturas', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('jt', $q$select to_jsonb(count(*)) from public.coffee_readings$q$);
  perform pg_temp.ok('La jefa de tienda ve las lecturas', (v_n#>>'{}')::int >= 4, v_n::text);
  v_n := pg_temp.call('off', $q$select to_jsonb(count(*)) from public.coffee_machines$q$);
  perform pg_temp.ok('Una jefa inactiva no ve nada', (v_n#>>'{}')::int = 0, v_n::text);
  v_n := pg_temp.call('admB', $q$select to_jsonb(count(*)) from public.coffee_machines$q$);
  perform pg_temp.ok('Otra empresa no ve nada', (v_n#>>'{}')::int = 0, v_n::text);
  v_msg := pg_temp.try('admB', format('select public.coffee_reconcile(%L, %L)', pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Otra empresa no cuadra máquinas ajenas', v_msg = 'inv:forbidden', v_msg);
  v_msg := pg_temp.try('adm', format($q$insert into public.coffee_readings (company_id, machine_id, read_on, shift, numeral) values (%L, %L, current_date, 'B', 1)$q$, pg_temp.g('A'), pg_temp.g('m1')));
  perform pg_temp.ok('Nadie escribe directo en las tablas', v_msg ilike '%permission denied%', v_msg);
  r := pg_temp.call('ji', format('select public.inv_apply_sales(%L, %L, %L::jsonb)', gen_random_uuid(), pg_temp.g('A'), pg_temp.lines(pg_temp.d(3),'219113','5')));
  perform pg_temp.ok('La jefa de isla no registra ventas de máquina', (r->>'no_access')::int = 1, r::text);
end $$;

do $$ begin raise notice 'MÁQUINAS DE CAFÉ: TODAS LAS PRUEBAS PASARON'; end $$;
rollback;
